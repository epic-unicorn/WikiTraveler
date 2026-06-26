/**
 * Import gzip JSON export into the database.
 *
 * Usage:
 *   pnpm node:import --file ./wikitraveler-export.json.gz
 */

import { readFileSync } from "fs";
import { gunzipSync } from "zlib";
import { PrismaClient } from "@prisma/client";
import { importExportPayload, type ExportPayload } from "../apps/node/lib/nodeDataTransfer";
import { recordIngestComplete } from "../apps/node/lib/nodeSettings";

const prisma = new PrismaClient();

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const file = argValue("--file");
  if (!file) throw new Error("Provide --file <path>");

  const raw = readFileSync(file);
  const json = file.endsWith(".gz") ? gunzipSync(raw) : raw;
  const payload = JSON.parse(json.toString("utf-8")) as ExportPayload;

  const result = await importExportPayload(payload);
  if (result.propertiesUpserted > 0) {
    await recordIngestComplete(result.propertiesUpserted);
  }

  console.log(`✓ Imported ${result.propertiesUpserted} properties, ${result.factsImported} facts`);
  if (result.factsProtected > 0) {
    console.log(`  (${result.factsProtected} facts protected from downgrade)`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
