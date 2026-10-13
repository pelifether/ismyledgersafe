// POST /api/share { receipt, photos, bought_from, country, bought_on }
// Only called when the owner opts in after seeing the result. Stores the
// photos (metadata stripped) and the verdict they got in the private Blob
// store under research/<date>/<id>/. No IP, name or other identifier is kept.
import { put } from "@vercel/blob";
import { blobToken, fail, foreign, json, limited, parsePhotos, verify } from "../lib/http.js";
import { blobAccess, storageReady } from "../lib/quota.js";

const SOURCES = ["", "ledger.com", "amazon", "retail_store", "authorized_reseller", "marketplace", "second_hand", "gift_other"];

export async function POST(request) {
  if (foreign(request)) return fail(403, "forbidden", "Forbidden.");
  if (limited(request, { max: 12 })) return fail(429, "burst", "Too many requests.");
  if (!storageReady()) return fail(503, "not_ready", "Research storage is not set up.");
  // With OIDC (BLOB_STORE_ID) the SDK finds its own credentials.
  const token = blobToken() || undefined;
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_photos", "Bad request.");
  }
  let receipt;
  try {
    receipt = verify(body?.receipt);
  } catch (error) {
    console.error("share failed", error?.message);
    return fail(503, "not_ready", "Not set up.");
  }
  if (!receipt) return fail(400, "expired", "This result has expired. Check again to share.");
  const photos = parsePhotos(body?.photos);
  if (!photos || photos.length !== receipt.photos.length || photos.some((p, i) => p.sha !== receipt.photos[i])) {
    return fail(400, "mismatch", "Photos do not match the check.");
  }
  const base = `research/${receipt.id.slice(0, 10)}/${receipt.id}`;
  const meta = {
    id: receipt.id,
    checked_at: new Date(receipt.at).toISOString(),
    shared_at: new Date().toISOString(),
    model: receipt.model,
    result: receipt.result,
    purchase: {
      bought_from: SOURCES.includes(body.bought_from) ? body.bought_from : "",
      country: /^[A-Z]{2}$/.test(body.country || "") ? body.country : "",
      bought_on: /^(\d{4}-(0[1-9]|1[0-2])|earlier)$/.test(body.bought_on || "") ? body.bought_on : "",
    },
    photos: photos.map((p, i) => ({ file: `photo-${i + 1}.jpg`, sha256: p.sha })),
    consent: "Owner chose 'Share for research' after the check.",
  };
  const options = { access: blobAccess(), token, addRandomSuffix: false, allowOverwrite: true };
  try {
    await Promise.all(photos.map((p, i) => put(`${base}/${meta.photos[i].file}`, p.bytes, { ...options, contentType: "image/jpeg" })));
    await put(`${base}/meta.json`, JSON.stringify(meta, null, 2), { ...options, contentType: "application/json" });
  } catch (error) {
    console.error("blob put failed", error?.message);
    return fail(502, "share_failed", "Could not save. Try again.");
  }
  return json({ ok: true, id: receipt.id });
}
