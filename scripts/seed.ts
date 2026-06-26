/**
 * Seed database from bundled sample export or legacy fixture.
 *
 * Usage: pnpm db:seed
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { gunzipSync } from "zlib";
import { importExportPayload, type ExportPayload } from "../apps/node/lib/nodeDataTransfer";
import { commitNodeBbox, recordIngestComplete } from "../apps/node/lib/nodeSettings";
import { fetchOverpassData, ingestOverpassResult } from "../apps/node/lib/overpass";

const prisma = new PrismaClient();
const NODE_ID = process.env.NODE_ID ?? "seed-script";
const EINDHOVEN_BBOX: [number, number, number, number] = [51.39, 5.42, 51.49, 5.52];
const SAMPLE = join(__dirname, "..", "apps", "node", "public", "samples", "eindhoven.json.gz");

async function main() {
  console.log("🌱 WikiTraveler seed starting…");

  if (existsSync(SAMPLE)) {
    console.log(`📦 Loading bundled sample ${SAMPLE}…`);
    const compressed = readFileSync(SAMPLE);
    const json = gunzipSync(compressed);
    const payload = JSON.parse(json.toString("utf-8")) as ExportPayload;
    await commitNodeBbox(EINDHOVEN_BBOX, "Eindhoven", "eindhoven");
    const result = await importExportPayload(payload);
    await recordIngestComplete(result.propertiesUpserted);
    const count = await prisma.property.count();
    console.log(`✨ Seed complete — ${count} properties (${result.propertiesUpserted} imported).`);
    await prisma.$disconnect();
    return;
  }

  const settings = await prisma.nodeSettings.findUnique({ where: { id: "default" } });
  const BBOX = settings?.bbox;

  if (!BBOX) {
    console.log("ℹ️  No sample file and no region configured — skipping OSM seed.");
    console.log("   Run pnpm node:build-sample or pnpm node:region --preset eindhoven");
    await prisma.$disconnect();
    return;
  }

  const fixturePath = join(__dirname, "fixtures", `osm-${BBOX.replace(/[^0-9.]/g, "_")}.json`);
  if (existsSync(fixturePath)) {
    console.log(`🗺  Legacy fixture — ingesting ${fixturePath}…`);
    const result = await fetchOverpassData("", fixturePath);
    const stats = await ingestOverpassResult(result, `${NODE_ID}:osm`, prisma);
    await recordIngestComplete(result.elements.length);
    console.log(`   Created: ${stats.created}  Updated: ${stats.updated}`);
    const count = await prisma.property.count();
    console.log(`✨ Seed complete — ${count} properties.`);
  } else {
    console.error(`❌ No sample at ${SAMPLE} and no fixture at ${fixturePath}`);
    if (process.env.REQUIRE_OSM_FIXTURE === "true") process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
