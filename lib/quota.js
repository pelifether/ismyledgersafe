// Durable daily limits on /api/check, kept in the Blob store so they hold
// across every function instance. Each check leaves one tiny marker at
// usage/<day>/<visitor>/<time>; counting markers by prefix gives the visitor's
// and the site's use today. The visitor key is an HMAC of the IP and the day,
// so it cannot be turned back into an IP or linked across days. Markers from
// earlier days are deleted.
import { createHmac } from "node:crypto";
import { del, list, put } from "@vercel/blob";
import { waitUntil } from "@vercel/functions";
import { blobToken, secret } from "./http.js";

const PER_VISITOR = Number(process.env.DAILY_CHECKS_PER_VISITOR || 5);
const PER_SITE = Number(process.env.DAILY_CHECKS || 100);

export const storageReady = () => Boolean(blobToken() || process.env.BLOB_STORE_ID);
export const blobAccess = () => (process.env.BLOB_ACCESS === "public" ? "public" : "private");
const today = () => new Date().toISOString().slice(0, 10);

export function visitorOf(request, day = today()) {
  const ip = request.headers.get("x-real-ip") || (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  return createHmac("sha256", secret()).update(`${day}|${ip}`).digest("hex").slice(0, 20);
}

async function count(prefix, token, stopAt) {
  let total = 0;
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000, token });
    total += page.blobs.length;
    cursor = page.hasMore && total < stopAt ? page.cursor : undefined;
  } while (cursor);
  return total;
}

// Delete markers from earlier days, a page at a time.
async function sweep(token, day) {
  const page = await list({ prefix: "usage/", limit: 1000, token });
  const old = page.blobs.filter((blob) => !blob.pathname.startsWith(`usage/${day}/`)).map((blob) => blob.url);
  if (old.length) await del(old, { token });
}

// Returns null when the check may run, or the error code for why it may not.
export async function spend(request) {
  if (!storageReady()) return process.env.VERCEL_ENV === "production" ? "not_ready" : null;
  const token = blobToken() || undefined;
  const day = today();
  const visitor = visitorOf(request, day);
  try {
    const [mine, all] = await Promise.all([count(`usage/${day}/${visitor}/`, token, PER_VISITOR), count(`usage/${day}/`, token, PER_SITE)]);
    if (mine >= PER_VISITOR) return "visitor_limit";
    if (all >= PER_SITE) return "site_limit";
    await put(`usage/${day}/${visitor}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, "1", { access: blobAccess(), token, addRandomSuffix: false, contentType: "text/plain" });
    if (Math.random() < 0.1) waitUntil(sweep(token, day).catch((error) => console.error("sweep failed", error?.message)));
    return null;
  } catch (error) {
    // Storage trouble should not take the checker down; the burst limit and
    // the API spend limit still apply.
    console.error("quota failed", error?.message);
    return null;
  }
}

// For /api/status: the limits, this visitor's use and the site total (a
// count only, nothing about other visitors).
export async function usage(request) {
  if (!storageReady()) return null;
  const token = blobToken() || undefined;
  const day = today();
  const [mine, all] = await Promise.all([count(`usage/${day}/${visitorOf(request, day)}/`, token, PER_VISITOR), count(`usage/${day}/`, token, PER_SITE)]);
  return { day, you: { used: mine, limit: PER_VISITOR }, site: { used: all, limit: PER_SITE } };
}
