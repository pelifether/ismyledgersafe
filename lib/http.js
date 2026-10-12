import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 1_600_000;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const fail = (status, error) => json({ error }, status);

// Photos arrive as data URLs, already shrunk and re-encoded in the browser
// (which also drops EXIF, GPS included).
export function parsePhotos(list) {
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_PHOTOS) return null;
  const photos = [];
  for (const item of list) {
    const match = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(item));
    if (!match || !TYPES.includes(match[1])) return null;
    const bytes = Math.floor((match[2].length * 3) / 4);
    if (bytes > MAX_PHOTO_BYTES) return null;
    photos.push({ type: match[1], data: match[2], sha: createHash("sha256").update(match[2]).digest("hex") });
  }
  return photos;
}

export const newId = () => new Date().toISOString().slice(0, 10) + "-" + randomUUID().slice(0, 8);

// A signed copy of the verdict, so a later "share for research" stores the
// same photos with the verdict they really got.
const secret = () => process.env.RECEIPT_SECRET || process.env.ANTHROPIC_API_KEY || "dev";
const b64 = (text) => Buffer.from(text).toString("base64url");
const mac = (text) => createHmac("sha256", secret()).update(text).digest("base64url");

export function sign(payload) {
  const body = b64(JSON.stringify(payload));
  return body + "." + mac(body);
}

export function verify(receipt) {
  const [body, given] = String(receipt || "").split(".");
  if (!body || !given) return null;
  const want = mac(body);
  if (want.length !== given.length || !timingSafeEqual(Buffer.from(want), Buffer.from(given))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (Date.now() - payload.at > 6 * 3600_000) return null;
    return payload;
  } catch {
    return null;
  }
}

// Fast per-instance limit for bursts; lib/quota.js holds the daily limits.
const hits = new Map();
export function limited(request, { max = 8, windowMs = 10 * 60_000 } = {}) {
  const ip = request.headers.get("x-real-ip") || (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > max;
}

// The Blob token. Vercel names it BLOB_READ_WRITE_TOKEN unless the store was
// connected with a custom prefix, so take any *_READ_WRITE_TOKEN.
export const blobToken = () =>
  process.env.BLOB_READ_WRITE_TOKEN || Object.entries(process.env).find(([key, value]) => key.endsWith("_READ_WRITE_TOKEN") && value)?.[1];

// Only this site's own page may call the API from a browser.
export function foreign(request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== (request.headers.get("x-forwarded-host") || request.headers.get("host"));
  } catch {
    return true;
  }
}
