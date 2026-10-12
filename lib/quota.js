// Durable daily limits on /api/check, kept in the Blob store so they hold
// across every function instance. Each check leaves one empty marker at
// usage/<day>/<visitor>/<time>; counting markers by prefix gives the visitor's
// and the site's use today. The visitor key is a salted hash of the IP, never
// the IP itself.
import { createHash } from "node:crypto";
import { list, put } from "@vercel/blob";
import { blobToken } from "./http.js";

const PER_VISITOR = Number(process.env.DAILY_CHECKS_PER_VISITOR || 20);
const PER_SITE = Number(process.env.DAILY_CHECKS || 300);

export const storageReady = () => Boolean(blobToken() || process.env.BLOB_STORE_ID);

export function visitorOf(request) {
  const ip = request.headers.get("x-real-ip") || (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  const salt = process.env.RECEIPT_SECRET || process.env.ANTHROPIC_API_KEY || "dev";
  return createHash("sha256").update(salt + ip).digest("hex").slice(0, 16);
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

// Returns null when the check may run, or the reason it may not.
export async function spend(request) {
  if (!storageReady()) return process.env.VERCEL_ENV === "production" ? "Limits are not set up." : null;
  const token = blobToken() || undefined;
  const day = new Date().toISOString().slice(0, 10);
  const visitor = visitorOf(request);
  try {
    const [mine, all] = await Promise.all([count(`usage/${day}/${visitor}/`, token, PER_VISITOR), count(`usage/${day}/`, token, PER_SITE)]);
    if (mine >= PER_VISITOR) return "You have reached today's limit of checks. Try again tomorrow.";
    if (all >= PER_SITE) return "The checker has reached its daily limit. Try again tomorrow.";
    await put(`usage/${day}/${visitor}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, "1", { access: process.env.BLOB_ACCESS === "public" ? "public" : "private", token, addRandomSuffix: false, contentType: "text/plain" });
    return null;
  } catch (error) {
    // Storage trouble should not take the checker down; the per-instance limit
    // and the API spend limit still apply.
    console.error("quota failed", error?.message);
    return null;
  }
}

// For /api/status: what the limits are and how much of them is used today.
export async function usage(request) {
  if (!storageReady()) return null;
  const token = blobToken() || undefined;
  const day = new Date().toISOString().slice(0, 10);
  const [mine, all] = await Promise.all([count(`usage/${day}/${visitorOf(request)}/`, token, PER_VISITOR), count(`usage/${day}/`, token, PER_SITE)]);
  return { day, you: { used: mine, limit: PER_VISITOR }, site: { used: all, limit: PER_SITE } };
}
