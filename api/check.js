// POST /api/check { photos: [JPEG data URL, ...], lang } -> { id, result, receipt }
// Photos are stripped of metadata, sent to Claude and not stored.
import { analyze, MODEL } from "../lib/analyze.js";
import { fail, foreign, json, limited, newId, parsePhotos, sign } from "../lib/http.js";
import { spend } from "../lib/quota.js";
import { mock } from "../lib/mock.js";

export async function POST(request) {
  if (foreign(request)) return fail(403, "forbidden", "Forbidden.");
  if (limited(request)) return fail(429, "burst", "Too many checks. Try again in a few minutes.");
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_photos", "Bad request.");
  }
  const photos = parsePhotos(body?.photos);
  if (!photos) return fail(400, "bad_photos", "Send 1 to 6 JPEG photos.");
  const lang = body?.lang === "pt" ? "pt" : "en";

  const live = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!live && process.env.MOCK !== "1") return fail(503, "not_ready", "The checker is not set up yet.");
  let result;
  try {
    const over = await spend(request);
    if (over) return fail(over === "not_ready" ? 503 : 429, over, "Limit reached.");
    result = live ? await analyze(photos, lang) : mock(photos.length);
  } catch (error) {
    // Never log request content: only the error's status and message.
    console.error("check failed", error?.status, error?.message);
    if (error?.status === 422) return fail(422, "refused", "These photos could not be checked.");
    return fail(502, "failed", "The check failed. Try again.");
  }
  const id = newId();
  const receipt = sign({ id, at: Date.now(), model: live ? MODEL : "mock", result, photos: photos.map((p) => p.sha) });
  return json({ id, result, receipt });
}
