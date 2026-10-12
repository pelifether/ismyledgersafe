// GET /api/status: whether the checker and storage are set up, and today's use
// of the daily limits. Calls no model.
import { json } from "../lib/http.js";
import { storageReady, usage } from "../lib/quota.js";

export async function GET(request) {
  let limits = null;
  let error;
  try {
    limits = await usage(request);
  } catch (e) {
    error = "storage unreachable";
    console.error("status failed", e?.message);
  }
  return json({ checker: Boolean(process.env.ANTHROPIC_API_KEY), storage: storageReady(), receipts: Boolean(process.env.RECEIPT_SECRET), limits, ...(error ? { error } : {}) });
}
