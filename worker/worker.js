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
 *   CHECK_IN_RANGE       - the start-of-hunt check-in form, also for the tracker
 *                          (optional; without it, check-ins just aren't shown)
 *   PHOTO_LEADERBOARD_RANGE
 *                        - the photo challenge standings
 *   PHOTO_DATA_RANGE     - photo submissions, for the photo stream (see photos.js;
 *                          also needs TEAMS_RANGE and the PHOTO_SIGNING_SECRET secret)
 *   PHOTO_SIGNING_SECRET - secret that encrypts photo links; set it with
 *                          `openssl rand -hex 32 | npx wrangler secret put PHOTO_SIGNING_SECRET`
 *   ALLOWED_ORIGIN       - your site's origin, for CORS (defaults to "*")
 */

import { buildTracker } from "./tracker.js";
import {
  fetchPhotoPreview,
  openPhotoToken,
  parsePhotoStream,
  photoLinkExpiry,
  sealPhotoToken,
} from "./photos.js";

const DEFAULT_RANGE = "Sheet1!A1:Z1000";

// Sheet data is reused for this long, so many viewers refreshing at once
// share one Sheets API response instead of each making their own request.
const SHEET_CACHE_MS = 30 * 1000;

// A Google call that takes longer than this is abandoned, so a slow or stuck
// one can't keep a visitor waiting forever
const GOOGLE_TIMEOUT_MS = 10 * 1000;

export default {
  async fetch(request, env, ctx) {
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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Photo previews: the token in the path is the proof of access
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname.startsWith("/photo/")) {
      return servePhoto(env, url.pathname.slice("/photo/".length));
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
      const data = await getSiteData(env, ctx);
      const photoStream = await signPhotoStream(env, data.photoStream);
      // `values` is kept for frontends deployed before `leaderboard` existed
      return json(
        { values: data.leaderboard, ...data, photoStream },
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

// The fetch in flight, shared so visitors arriving together make one Google
// request between them (Google allows about 60 Sheets reads a minute). An
// in-flight fetch belongs to the request that started it, so it's kept alive
// with waitUntil: otherwise, if that visitor left, Cloudflare would cancel it
// and everyone waiting on it would hang. Each waiter also gives up after
// SHARED_WAIT_MS, and a fetch older than that is replaced, as backstops.
let pendingSiteData = null;
let pendingStartedAt = 0;
const SHARED_WAIT_MS = GOOGLE_TIMEOUT_MS * 2 + 5 * 1000;

async function getSiteData(env, ctx) {
  if (cachedSiteData && Date.now() - cachedSiteData.at < SHEET_CACHE_MS) {
    return cachedSiteData.data;
  }
  if (!pendingSiteData || Date.now() - pendingStartedAt > SHARED_WAIT_MS) {
    const fetching = fetchSiteData(env)
      .then((data) => {
        cachedSiteData = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        if (pendingSiteData === fetching) pendingSiteData = null;
      });
    pendingSiteData = fetching;
    pendingStartedAt = Date.now();
    ctx.waitUntil(fetching.catch(() => {}));
  }
  try {
    return await withTimeout(pendingSiteData, SHARED_WAIT_MS);
  } catch (err) {
    // Slightly old data beats an error page if Google is having a moment
    if (cachedSiteData) {
      console.error("Sheet fetch failed, serving cached data", { message: err?.message });
      return cachedSiteData.data;
    }
    throw err;
  }
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fetchSiteData(env) {
  const accessToken = await getGoogleAccessToken(env);
  const leaderboardRange = env.SHEET_RANGE || DEFAULT_RANGE;
  const updatedAt = new Date().toISOString();

  // Everything beyond the main leaderboard is optional and fetched in the same
  // request; a tab is only requested if its range is configured
  const optional = {
    teams: env.TEAMS_RANGE,
    checkIn: env.CHECK_IN_RANGE,
    form: env.FORM_DATA_RANGE,
    finish: env.FINISH_RANGE,
    photoLeaderboard: env.PHOTO_LEADERBOARD_RANGE,
    photoData: env.PHOTO_DATA_RANGE,
  };
  const keys = Object.keys(optional).filter((key) => optional[key]);

  if (keys.length > 0) {
    try {
      const [leaderboard, ...rows] = await batchGetRanges(env, accessToken, [
        leaderboardRange,
        ...keys.map((key) => optional[key]),
      ]);
      const tabs = Object.fromEntries(keys.map((key, i) => [key, rows[i]]));
      return {
        leaderboard,
        tracker:
          tabs.teams && tabs.form && tabs.finish
            ? buildTracker({
                teamsRows: tabs.teams,
                checkInRows: tabs.checkIn ?? [],
                formRows: tabs.form,
                finishRows: tabs.finish,
              })
            : null,
        photoLeaderboard: tabs.photoLeaderboard ?? null,
        // File IDs stay server-side; signPhotoStream turns them into links
        photoStream:
          tabs.photoData && tabs.teams ? parsePhotoStream(tabs.photoData, tabs.teams) : null,
        updatedAt,
      };
    } catch (err) {
      // A renamed or missing extra tab shouldn't take the leaderboard down
      console.error("Extra tabs fetch failed, falling back to leaderboard only", {
        message: err?.message,
      });
    }
  }

  const [leaderboard] = await batchGetRanges(env, accessToken, [leaderboardRange]);
  return { leaderboard, tracker: null, photoLeaderboard: null, photoStream: null, updatedAt };
}

// Swaps each photo's Drive file ID for an expiring /photo/<token> path. It's
// a path, not a full URL, because the worker can't always tell its own public
// address (in `wrangler dev --remote` it sees the deployed hostname); the site
// resolves it against the worker URL it called.
//
// A photo's link only changes when its expiry does (see photoLinkExpiry), so
// each link is remembered and only new or renewing photos are encrypted. That
// keeps the CPU cost per request tiny even with hundreds of photos.
const photoLinks = new Map(); // fileId -> { expiresAt, src }

async function signPhotoStream(env, photos) {
  if (!photos || !env.PHOTO_SIGNING_SECRET) return null;
  const now = Date.now();
  const signed = await Promise.all(
    photos.map(async ({ fileId, sortKey, ...photo }) => {
      const expiresAt = photoLinkExpiry(fileId, now);
      let link = photoLinks.get(fileId);
      if (!link || link.expiresAt !== expiresAt) {
        const token = await sealPhotoToken(env.PHOTO_SIGNING_SECRET, fileId, expiresAt);
        link = { expiresAt, src: `/photo/${token}` };
        photoLinks.set(fileId, link);
      }
      return { ...photo, src: link.src };
    })
  );
  // Forget links for photos that are no longer in the stream
  if (photoLinks.size > photos.length) {
    const current = new Set(photos.map((p) => p.fileId));
    for (const fileId of photoLinks.keys()) {
      if (!current.has(fileId)) photoLinks.delete(fileId);
    }
  }
  return signed;
}

async function servePhoto(env, token) {
  const fileId = env.PHOTO_SIGNING_SECRET
    ? await openPhotoToken(env.PHOTO_SIGNING_SECRET, token)
    : null;
  if (!fileId) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const preview = await fetchPhotoPreview(fileId, await getGoogleAccessToken(env));
    if (!preview) {
      return new Response("Photo unavailable", { status: 502 });
    }
    return new Response(preview.body, {
      headers: {
        "Content-Type": preview.headers.get("Content-Type") || "image/jpeg",
        // The link itself expires, so browsers can keep the image until then
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Photo error", { message: err?.message });
    return new Response("Photo unavailable", { status: 502 });
  }
}

// Fetches several ranges in one Sheets API request; returns their rows in order
async function batchGetRanges(env, accessToken, ranges) {
  const params = new URLSearchParams();
  ranges.forEach((range) => params.append("ranges", range));
  const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}/values:batchGet?${params}`;

  const sheetRes = await fetch(sheetUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
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

// Reused across requests within this worker instance until it nearly expires,
// since every photo preview needs one
let cachedAccessToken = null; // { token, expiresAt }

async function getGoogleAccessToken(env) {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt) {
    return cachedAccessToken.token;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: env.GOOGLE_CLIENT_EMAIL,
    scope: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      // For photo stream previews of the photo challenge uploads
      "https://www.googleapis.com/auth/drive.readonly",
    ].join(" "),
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
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
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
  // Tokens last an hour; refresh a few minutes early
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + ((tokenData.expires_in || 3600) - 300) * 1000,
  };
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