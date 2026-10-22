/**
 * The photo stream: recent photo challenge submissions, served through the
 * worker so the Drive files are never exposed to visitors.
 *
 * Each photo is linked as /photo/<token>, where the token is the Drive file ID
 * and an expiry time, encrypted with PHOTO_SIGNING_SECRET. Only visitors who
 * passed the password check receive tokens, tokens stop working after
 * PHOTO_LINK_TTL_MS, and the file ID can't be read out of one (the upload
 * folder's files are link-shared, so their IDs must stay private).
 */

import { parseTeams, parseTimestamp, formatTimeOfDay } from "./tracker.js";

// Newest photos sent to the site; it renders them a few at a time as visitors
// scroll. The cap keeps the per-minute refresh small on cellular data (about
// 250 bytes per photo), and keeps a fresh worker instance's first request,
// which encrypts every photo's link (~21 microseconds each), under the
// Cloudflare free plan's 10 ms CPU limit. On the paid plan it can go to 1000+.
const MAX_PHOTOS = 300;
export const PHOTO_LINK_TTL_MS = 2 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// Expiry rounded up to the hour, so links stay the same within each hour and
// are always valid for at least PHOTO_LINK_TTL_MS
//
// Each photo's hour boundary is offset by an amount picked from its file ID,
// so links renew a few at a time through the hour rather than all at once.
export function photoLinkExpiry(fileId, now = Date.now()) {
  let hash = 2166136261;
  for (let i = 0; i < fileId.length; i++) {
    hash = Math.imul(hash ^ fileId.charCodeAt(i), 16777619) >>> 0;
  }
  const offset = hash % HOUR_MS;
  return Math.ceil((now + PHOTO_LINK_TTL_MS - offset) / HOUR_MS) * HOUR_MS + offset;
}

// Previews are resized by Drive to this many pixels on the longest side:
// sharp at the feed's width on a phone, a small fraction of the original's size
const PREVIEW_SIZE = 720;

// Returns the index of the first header matching the pattern, or -1
function findColumn(headers, pattern) {
  return headers.findIndex((h) => pattern.test(String(h ?? "").trim()));
}

// Pulls Drive file IDs out of a cell like
// "https://drive.google.com/open?id=abc, https://drive.google.com/open?id=def"
export function parseDriveIds(cell) {
  return String(cell ?? "")
    .split(/[,\s]+/)
    .map((link) => link.match(/[?&]id=([\w-]+)/) || link.match(/\/d\/([\w-]+)/))
    .filter(Boolean)
    .map((match) => match[1]);
}

/**
 * Photo Data tab: one row per form submission, with the team number, the
 * uploaded photos' Drive links, and optionally a bird count and a Hide column
 * judges can mark. Returns the newest photos first, named by the Teams tab.
 */
export function parsePhotoStream(photoRows, teamsRows) {
  const [headers = [], ...data] = photoRows;
  const timeCol = findColumn(headers, /timestamp/i);
  const numberCol = findColumn(headers, /team\s*(#|number)/i);
  const linksCol = findColumn(headers, /upload/i);
  const birdsCol = findColumn(headers, /bird/i);
  const hideCol = findColumn(headers, /^hide/i);
  if (timeCol < 0 || numberCol < 0 || linksCol < 0) return [];

  const teamNames = new Map(parseTeams(teamsRows).map((t) => [t.number, t.name]));

  const photos = [];
  for (const row of data) {
    const time = parseTimestamp(row[timeCol]);
    const hidden = hideCol >= 0 && /^(true|yes|x|hide)$/i.test(String(row[hideCol] ?? "").trim());
    if (time == null || hidden) continue;

    const number = parseInt(String(row[numberCol] ?? "").trim(), 10);
    const birds = birdsCol >= 0 ? String(row[birdsCol] ?? "").trim() : "";
    parseDriveIds(row[linksCol]).forEach((fileId, i) => {
      photos.push({
        fileId,
        team: teamNames.get(number) || (Number.isFinite(number) ? `Team ${number}` : "Unknown team"),
        birds: birds === "" ? null : birds,
        since: formatTimeOfDay(time),
        // Keeps photos from one submission in upload order
        sortKey: time * 100 + i,
      });
    });
  }

  return photos.sort((a, b) => b.sortKey - a.sortKey).slice(0, MAX_PHOTOS);
}

// --- Photo tokens: AES-GCM encrypted "<fileId>|<expiresAt>" ---

// The key is derived once per secret and reused, since a page refresh may
// seal hundreds of tokens
const tokenKeys = new Map();

function tokenKey(secret) {
  if (!tokenKeys.has(secret)) {
    tokenKeys.set(
      secret,
      crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(secret))
        .then((digest) =>
          crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"])
        )
    );
  }
  return tokenKeys.get(secret);
}

function toBase64url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text) {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// The same photo and expiry always produce the same token, so the page's
// minute-by-minute refreshes don't change image URLs (and re-download every
// photo). The IV is derived from the plaintext, so it's unique per token.
export async function sealPhotoToken(secret, fileId, expiresAt) {
  const ivSource = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${secret}|${fileId}|${expiresAt}`)
  );
  const iv = new Uint8Array(ivSource).slice(0, 12);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await tokenKey(secret),
      new TextEncoder().encode(`${fileId}|${expiresAt}`)
    )
  );
  const token = new Uint8Array(iv.length + sealed.length);
  token.set(iv);
  token.set(sealed, iv.length);
  return toBase64url(token);
}

// Returns the file ID, or null if the token is forged, damaged, or expired
export async function openPhotoToken(secret, token, now = Date.now()) {
  try {
    const bytes = fromBase64url(token);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12) },
      await tokenKey(secret),
      bytes.slice(12)
    );
    const [fileId, expiresAt] = new TextDecoder().decode(plain).split("|");
    return Number(expiresAt) > now ? fileId : null;
  } catch {
    return null;
  }
}

// --- Serving previews from Drive ---

/**
 * Fetches a resized preview of a Drive image. Drive's thumbnail links need
 * the service account's token and stop working after a few hours, so they're
 * looked up fresh. Returns null if Drive hasn't made a thumbnail yet (it can
 * take a few minutes after upload) rather than sending the multi-megabyte
 * original.
 */
export async function fetchPhotoPreview(fileId, accessToken) {
  const auth = { Authorization: `Bearer ${accessToken}` };
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&supportsAllDrives=true`,
    { headers: auth }
  );
  if (!metaRes.ok) {
    console.error("Drive metadata error", { status: metaRes.status, body: await metaRes.text() });
    return null;
  }

  const { thumbnailLink } = await metaRes.json();
  if (thumbnailLink) {
    const previewUrl = thumbnailLink.replace(/=s\d+$/, `=s${PREVIEW_SIZE}`);
    const previewRes = await fetch(previewUrl, { headers: auth });
    if (previewRes.ok) return previewRes;
    console.error("Drive thumbnail error", { status: previewRes.status });
  }
  return null;
}
