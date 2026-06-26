/**
 * Build bundled Eindhoven sample export for Admin one-click import and db:seed.
 *
 * Usage: pnpm node:build-sample
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { gzipSync } from "zlib";
import { PrismaClient } from "@prisma/client";
import { fetchOverpassData, ingestOverpassResult } from "../apps/node/lib/overpass";
import { buildExportPayload } from "../apps/node/lib/nodeDataTransfer";

const prisma = new PrismaClient();
const NODE_ID = process.env.NODE_ID ?? "sample-build";
const FIXTURE = join(__dirname, "fixtures", "osm-51.39_5.42_51.49_5.52.json");
const OUT_DIR = join(__dirname, "..", "apps", "node", "public", "samples");
const OUT_FILE = join(OUT_DIR, "eindhoven.json.gz");

async function main() {
  console.log("Building sample from fixture…");
  const result = await fetchOverpassData("", FIXTURE);
  await ingestOverpassResult(result, `${NODE_ID}:osm`, prisma);

  const payload = await buildExportPayload();
  mkdirSync(OUT_DIR, { recursive: true });
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), "utf-8"));
  writeFileSync(OUT_FILE, compressed);

  console.log(`✓ Sample written: ${OUT_FILE}`);
  console.log(`  ${payload.properties.length} properties, ${payload.facts.length} facts`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
