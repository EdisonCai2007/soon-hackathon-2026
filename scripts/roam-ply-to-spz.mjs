#!/usr/bin/env node
// Compresses a Gaussian-splat PLY to Spark's SPZ, keeping its spherical harmonics, so the ROAM scan fits
// Cloudflare's 25 MiB file limit. Run by hand: node scripts/roam-ply-to-spz.mjs <in.ply> [out.spz]
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const LIMIT = 25 * 1024 * 1024;
const [input, output = fileURLToPath(new URL("../app/public/apps/roam/room.spz", import.meta.url))] =
  process.argv.slice(2);
if (!input) {
  console.error("Usage: node scripts/roam-ply-to-spz.mjs <in.ply> [out.spz]");
  process.exit(2);
}

// Spark ships with the app's packages: install them in app/ first.
const { transcodeSpz } = await import(
  new URL("../app/node_modules/@sparkjsdev/spark/dist/spark.module.js", import.meta.url).href
);

const ply = new Uint8Array(await readFile(input));
const { fileBytes } = await transcodeSpz({ inputs: [{ fileBytes: ply, pathOrUrl: input }], maxSh: 3 });
await writeFile(output, fileBytes);

const mib = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
console.log(`${input} (${mib(ply.length)}) → ${output} (${mib(fileBytes.length)})`);
if (fileBytes.length >= LIMIT) {
  console.error(`Too big: Cloudflare serves files under ${mib(LIMIT)}.`);
  process.exit(1);
}
