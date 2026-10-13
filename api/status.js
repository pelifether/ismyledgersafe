// GET /api/status: whether the checker, storage and receipts are set up, and
// how many of today's checks the caller has used. Calls no model and shows
// nothing about other visitors.
import { json } from "../lib/http.js";
import { storageReady, usage } from "../lib/quota.js";

export async function GET(request) {
  let limits = null;
  let error;
  try {
    limits = await usage(request);
  } catch (e) {
    error = "unavailable";
    console.error("status failed", e?.message);
  }
  return json({
    checker: Boolean(process.env.ANTHROPIC_API_KEY),
    storage: storageReady(),
    receipts: !process.env.RECEIPT_SECRET ? false : process.env.RECEIPT_SECRET.length >= 16 ? true : "weak",
    limits,
    ...(error ? { error } : {}),
  });
}
