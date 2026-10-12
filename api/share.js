// POST /api/share { receipt, photos, bought_from, country, bought_on }
// Only called when the owner opts in. Stores the photos and the verdict they
// got in Vercel Blob under research/<date>/<id>/.
import { put } from "@vercel/blob";
import { fail, json, limited, parsePhotos, verify } from "../lib/http.js";

const SOURCES = ["", "ledger.com", "amazon", "retail_store", "authorized_reseller", "marketplace", "second_hand", "gift_other"];
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(request) {
  if (limited(request, { max: 12 })) return fail(429, "Too many requests.");
  if (!process.env.BLOB_READ_WRITE_TOKEN) return fail(503, "Research storage is not set up.");
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Bad request.");
  }
  const receipt = verify(body?.receipt);
  if (!receipt) return fail(400, "This result has expired. Check again to share.");
  const photos = parsePhotos(body?.photos);
  if (!photos || photos.length !== receipt.photos.length || photos.some((p, i) => p.sha !== receipt.photos[i])) {
    return fail(400, "Photos do not match the check.");
  }
  const access = process.env.BLOB_ACCESS === "public" ? "public" : "private";
  const base = `research/${receipt.id.slice(0, 10)}/${receipt.id}`;
  const meta = {
    id: receipt.id,
    checked_at: new Date(receipt.at).toISOString(),
    shared_at: new Date().toISOString(),
    model: receipt.model,
    result: receipt.result,
    purchase: {
      bought_from: SOURCES.includes(body.bought_from) ? body.bought_from : "",
      country: String(body.country || "").replace(/[^\p{L}\p{M} .,'-]/gu, "").slice(0, 40),
      bought_on: /^\d{4}-\d{2}$/.test(body.bought_on || "") ? body.bought_on : "",
    },
    photos: photos.map((p, i) => ({ file: `photo-${i + 1}.${EXT[p.type]}`, sha256: p.sha })),
    consent: "Owner chose 'Share for research' after the check.",
  };
  try {
    await Promise.all(
      photos.map((p, i) => put(`${base}/${meta.photos[i].file}`, Buffer.from(p.data, "base64"), { access, contentType: p.type, addRandomSuffix: false, allowOverwrite: true })),
    );
    await put(`${base}/meta.json`, JSON.stringify(meta, null, 2), { access, contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
  } catch (error) {
    console.error("blob put failed", error?.message);
    return fail(502, "Could not save. Try again.");
  }
  return json({ ok: true, id: receipt.id });
}
