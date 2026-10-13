import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 1_600_000;

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });

// Errors carry a code the page translates; the message is a fallback.
export const fail = (status, code, error) => json({ code, error }, status);

// Keep a JPEG's image data and drop everything that can describe the person
// or place: EXIF (GPS, camera serial, time), XMP, IPTC, MakerNotes and
// comments. The browser already re-encodes photos without them; this holds
// even for a request that did not come from the page.
const KEEP = new Set([0xe0, 0xe2, 0xee]); // JFIF, ICC colour profile, Adobe colour transform
export function stripJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  const parts = [buffer.subarray(0, 2)];
  let at = 2;
  while (at + 4 <= buffer.length) {
    if (buffer[at] !== 0xff) return null;
    const marker = buffer[at + 1];
    if (marker === 0xff) {
      at++;
      continue;
    }
    if (marker === 0xda) {
      parts.push(buffer.subarray(at));
      return Buffer.concat(parts);
    }
    const length = buffer.readUInt16BE(at + 2);
    if (length < 2 || at + 2 + length > buffer.length) return null;
    const metadata = (marker >= 0xe0 && marker <= 0xef && !KEEP.has(marker)) || marker === 0xfe;
    if (!metadata) parts.push(buffer.subarray(at, at + 2 + length));
    at += 2 + length;
  }
  return null;
}

// Photos arrive as JPEG data URLs, shrunk and re-encoded in the browser.
export function parsePhotos(list) {
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_PHOTOS) return null;
  const photos = [];
  for (const item of list) {
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(item));
    if (!match || (match[1].length * 3) / 4 > MAX_PHOTO_BYTES) return null;
    const clean = stripJpeg(Buffer.from(match[1], "base64"));
    if (!clean) return null;
    const data = clean.toString("base64");
    photos.push({ type: "image/jpeg", data, bytes: clean, sha: createHash("sha256").update(clean).digest("hex") });
  }
  return photos;
}

export const newId = () => new Date().toISOString().slice(0, 10) + "-" + randomUUID().slice(0, 8);

// Secrets for signing receipts and hashing visitors. Production must set
// RECEIPT_SECRET; nothing falls back to another credential.
export function secret() {
  const value = process.env.RECEIPT_SECRET;
  if (value) return value;
  if (process.env.VERCEL_ENV === "production") throw new Error("RECEIPT_SECRET is not set");
  return "dev-only-secret";
}

// A signed copy of the verdict, so a later "share for research" stores the
// same photos with the verdict they really got.
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
