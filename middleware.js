// Vercel Routing Middleware: serve the page in the visitor's language.
import { rewrite } from "@vercel/functions/middleware";
import { pageFor } from "./lib/language.js";

export const config = { matcher: ["/"] };

export default function middleware(request) {
  return rewrite(new URL(pageFor(request), request.url));
}
