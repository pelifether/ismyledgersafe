// Downloads every shared submission to ./research/ for study.
// BLOB_READ_WRITE_TOKEN=... npm run export
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { get, list } from "@vercel/blob";

const access = process.env.BLOB_ACCESS === "public" ? "public" : "private";
let cursor;
let count = 0;
do {
  const page = await list({ prefix: "research/", cursor, limit: 1000 });
  for (const blob of page.blobs) {
    const target = join("research", blob.pathname.replace(/^research\//, ""));
    await mkdir(dirname(target), { recursive: true });
    const { stream } = await get(blob.pathname, { access });
    await writeFile(target, Buffer.from(await new Response(stream).arrayBuffer()));
    count++;
  }
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);
console.log(`downloaded ${count} files to ./research`);
