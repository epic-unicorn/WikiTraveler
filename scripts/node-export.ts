/**
 * Export node data as gzip JSON.
 *
 * Usage:
 *   pnpm node:export --out ./wikitraveler-export.json.gz
 */

import { writeFileSync } from "fs";
import { gzipSync } from "zlib";
import { PrismaClient } from "@prisma/client";
import { buildExportPayload } from "../apps/node/lib/nodeDataTransfer";

const prisma = new PrismaClient();

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const out =
    argValue("--out") ??
    `wikitraveler-export-${new Date().toISOString().slice(0, 10)}.json.gz`;

  const payload = await buildExportPayload();
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), "utf-8"));
  writeFileSync(out, compressed);

  console.log(`✓ Exported ${payload.properties.length} properties, ${payload.facts.length} facts`);
  console.log(`  → ${out}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
