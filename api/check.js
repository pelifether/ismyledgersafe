// POST /api/check { photos: [dataURL, ...] } -> { id, result, receipt }
// Photos are sent to Claude and not stored.
import { analyze, MODEL } from "../lib/analyze.js";
import { fail, json, limited, newId, parsePhotos, sign } from "../lib/http.js";
import { mock } from "../lib/mock.js";

export async function POST(request) {
  if (limited(request)) return fail(429, "Too many checks. Try again in a few minutes.");
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Bad request.");
  }
  const photos = parsePhotos(body?.photos);
  if (!photos) return fail(400, "Send 1 to 6 photos (JPEG, PNG or WebP).");

  const live = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!live && process.env.MOCK !== "1") return fail(503, "The checker is not set up yet.");
  let result;
  try {
    result = live ? await analyze(photos) : mock(photos.length);
  } catch (error) {
    console.error("analyze failed", error?.status, error?.message);
    if (error?.status === 422) return fail(422, "These photos could not be checked.");
    return fail(502, "The check failed. Try again.");
  }
  const { observations, ...shown } = result;
  const id = newId();
  const receipt = sign({ id, at: Date.now(), model: live ? MODEL : "mock", result, photos: photos.map((p) => p.sha) });
  return json({ id, result: shown, receipt });
}
