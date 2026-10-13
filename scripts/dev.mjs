// Local server: serves public/ and routes /api/<name> to api/<name>.js.
// MOCK=1 npm run dev  -> canned verdicts, no API key needed.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { pageFor } from "../lib/language.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT || 3000);
// The same headers Vercel sends, so the Content-Security-Policy is tested locally.
const HEADERS = Object.fromEntries(JSON.parse(await readFile(join(ROOT, "vercel.json"), "utf8")).headers[0].headers.map(({ key, value }) => [key, value]));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      const name = url.pathname.slice(5).replace(/[^a-z]/g, "");
      const mod = await import(join(ROOT, "api", `${name}.js`));
      const handler = mod[req.method];
      if (!handler) return void res.writeHead(405).end();
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const request = new Request(url, { method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return void res.end(Buffer.from(await response.arrayBuffer()));
    }
    // middleware.js picks the page by country; locally, pass x-vercel-ip-country.
    const page = url.pathname === "/" ? pageFor(new Request(url, { headers: req.headers })) : url.pathname;
    const path = normalize(page).replace(/^(\.\.[/\\])+/, "");
    const data = await readFile(join(ROOT, "public", path));
    res.writeHead(200, { ...HEADERS, "content-type": TYPES[extname(path)] || "application/octet-stream" }).end(data);
  } catch (error) {
    if (error.code !== "ENOENT") console.error(error);
    res.writeHead(error.code === "ENOENT" ? 404 : 500).end();
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
