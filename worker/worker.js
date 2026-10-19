/**
 * Cloudflare Worker: password-gated proxy for a private Google Sheet.
 *
 * Required secrets (set via `wrangler secret put NAME`):
 *   SITE_PASSWORD        - the password visitors must supply
 *   GOOGLE_CLIENT_EMAIL  - service account email, from the downloaded JSON key
 *   GOOGLE_PRIVATE_KEY   - service account private key (the full PEM string,
 *                          including the ----BEGIN/END PRIVATE KEY---- lines)
 *   SHEET_ID             - the ID from the sheet's URL
 *                          (docs.google.com/spreadsheets/d/<THIS_PART>/edit)
 *
 * Optional var (set via `wrangler.toml` [vars] or `wrangler secret put`):
 *   SHEET_RANGE          - e.g. "Leaderboard!A1:D100" (defaults below)
 *   TEAMS_RANGE, FORM_DATA_RANGE, FINISH_RANGE
 *                        - tabs the live tracker reads (see tracker.js)
 *   ALLOWED_ORIGIN       - your site's origin, for CORS (defaults to "*")
 */

import { buildTracker } from "./tracker.js";

const DEFAULT_RANGE = "Sheet1!A1:Z1000";

// Sheet data is reused for this long, so many viewers refreshing at once
// share one Sheets API request instead of each making their own.
const SHEET_CACHE_MS = 30 * 1000;

export default {
  async fetch(request, env) {
    // ALLOWED_ORIGIN can be a single origin or a comma-separated list,
    // e.g. "https://sanfranciscohunt.com,http://localhost:3000"
    const allowList = (env.ALLOWED_ORIGIN || "*")
      .split(",")
      .map((o) => o.trim());
    const requestOrigin = request.headers.get("Origin") || "";
    const originToSend =
      allowList.includes("*")
        ? "*"
        : allowList.includes(requestOrigin)
        ? requestOrigin
        : "null";

    const corsHeaders = {
      "Access-Control-Allow-Origin": originToSend,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, corsHeaders);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, corsHeaders);
    }

    const suppliedPassword = body?.password ?? "";
    if (!timingSafeEqual(suppliedPassword, env.SITE_PASSWORD)) {
      // Deliberately vague error so it doesn't help someone brute-force
      return json({ error: "Unauthorized" }, 401, corsHeaders);
    }

    try {
      const data = await getSiteData(env);
      // `values` is kept for frontends deployed before `leaderboard` existed
      return json(
        { values: data.leaderboard, ...data },
        200,
        corsHeaders
      );
    } catch (err) {
      if (err instanceof SheetsError) {
        return json(
          { error: "Failed to fetch sheet", status: err.status },
          502,
          corsHeaders
        );
      }
      console.error("Worker error", {
        message: err?.message,
        stack: err?.stack,
      });
      return json({ error: "Server error" }, 500, corsHeaders);
    }
  },
};

class SheetsError extends Error {
  constructor(status) {
    super(`Sheets API error ${status}`);
    this.status = status;
  }
}

// Reused across requests within this worker instance (see SHEET_CACHE_MS)
let cachedSiteData = null; // { at, data }
let pendingSiteData = null;

async function getSiteData(env) {
  if (cachedSiteData && Date.now() - cachedSiteData.at < SHEET_CACHE_MS) {
    return cachedSiteData.data;
  }
  // If a fetch is already in flight, share it rather than starting another
  if (!pendingSiteData) {
    pendingSiteData = fetchSiteData(env)
      .then((data) => {
        cachedSiteData = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        pendingSiteData = null;
      });
  }
  return pendingSiteData;
}

async function fetchSiteData(env) {
  const accessToken = await getGoogleAccessToken(env);
  const leaderboardRange = env.SHEET_RANGE || DEFAULT_RANGE;
  const trackerRanges = [env.TEAMS_RANGE, env.FORM_DATA_RANGE, env.FINISH_RANGE];
  const updatedAt = new Date().toISOString();

  if (trackerRanges.every(Boolean)) {
    try {
      const [leaderboard, teamsRows, formRows, finishRows] = await batchGetRanges(
        env,
        accessToken,
        [leaderboardRange, ...trackerRanges]
      );
      return {
        leaderboard,
        tracker: buildTracker({ teamsRows, formRows, finishRows }),
        updatedAt,
      };
    } catch (err) {
      // A renamed or missing tracker tab shouldn't take the leaderboard down
      console.error("Tracker fetch failed, falling back to leaderboard only", {
        message: err?.message,
      });
    }
  }

  const [leaderboard] = await batchGetRanges(env, accessToken, [leaderboardRange]);
  return { leaderboard, tracker: null, updatedAt };
}

// Fetches several ranges in one Sheets API request; returns their rows in order
async function batchGetRanges(env, accessToken, ranges) {
  const params = new URLSearchParams();
  ranges.forEach((range) => params.append("ranges", range));
  const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}/values:batchGet?${params}`;

  const sheetRes = await fetch(sheetUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!sheetRes.ok) {
    const errText = await sheetRes.text();
    // Full detail goes to Observability logs; client gets a terse response.
    console.error("Sheets API error", {
      status: sheetRes.status,
      statusText: sheetRes.statusText,
      requestedUrl: sheetUrl,
      body: errText,
    });
    throw new SheetsError(sheetRes.status);
  }

  const sheetData = await sheetRes.json();
  // Each valueRange's values is an array of rows (each row an array of cell strings)
  return (sheetData.valueRanges || []).map((r) => r.values || []);
}

function json(obj, status, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

// Constant-time-ish string comparison to avoid trivial timing attacks on the password check.
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// --- Google service-account auth (JWT bearer flow), using Web Crypto only ---

async function getGoogleAccessToken(env) {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: env.GOOGLE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encHeader = base64url(JSON.stringify(header));
  const encClaim = base64url(JSON.stringify(claimSet));
  const signingInput = `${encHeader}.${encClaim}`;

  const key = await importPrivateKey(env.GOOGLE_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${base64url(signature)}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error("Google token exchange failed", {
      status: tokenRes.status,
      body: errText,
    });
    throw new Error("Google token exchange failed");
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function importPrivateKey(pem) {
  const pemBody = pem
    .replace(/\\n/g, "\n")           // handle literal backslash-n from copy-paste
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binaryDer = base64ToArrayBuffer(pemBody);

  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64url(input) {
  let base64;
  if (typeof input === "string") {
    base64 = btoa(input);
  } else {
    // ArrayBuffer / TypedArray (e.g. a signature)
    const bytes = new Uint8Array(input);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}