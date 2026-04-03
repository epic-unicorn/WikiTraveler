/**
 * scripts/osm-ingest.ts
 *
 * Fetches accessibility data from the Overpass API for the configured
 * bounding box and ingests it into the database. On first run the raw
 * Overpass response is saved as a fixture so subsequent `pnpm db:reset`
 * calls work offline.
 *
 * Usage:
 *   pnpm osm:ingest                # fetch from Overpass, save + ingest
 *   pnpm osm:ingest --fixture-only # only save fixture, don't ingest
 */

import { PrismaClient } from "@prisma/client";
import { join } from "path";
import { fetchOverpassData, ingestOverpassResult } from "../apps/node/lib/overpass";

const prisma = new PrismaClient();

const BBOX = process.env.OSM_BBOX ?? "51.39,5.42,51.49,5.52";
const FIXTURE_PATH = join(__dirname, "fixtures", "eindhoven-osm.json");
const NODE_ID = process.env.NODE_ID ?? "seed-script";

async function main() {
  const fixtureOnly = process.argv.includes("--fixture-only");

  console.log(`🗺  OSM ingest starting…`);
  console.log(`   Bbox:    ${BBOX}`);
  console.log(`   Fixture: ${FIXTURE_PATH}`);

  const result = await fetchOverpassData(BBOX, FIXTURE_PATH);
  console.log(`   Elements fetched: ${result.elements.length}`);

  if (fixtureOnly) {
    console.log("✨ Fixture saved. Skipping database ingest (--fixture-only).");
    await prisma.$disconnect();
    return;
  }

  const stats = await ingestOverpassResult(result, `${NODE_ID}:osm`, prisma);

  // Record sync state
  await prisma.osmSyncState.upsert({
    where: { bbox: BBOX },
    update: { lastSync: new Date(), itemCount: result.elements.length },
    create: { bbox: BBOX, lastSync: new Date(), itemCount: result.elements.length },
  });

  console.log(`\n✨ OSM ingest complete:`);
  console.log(`   Total elements : ${stats.total}`);
  console.log(`   Properties created : ${stats.created}`);
  console.log(`   Properties updated : ${stats.updated}`);
  console.log(`   Spatial deduped    : ${stats.deduped}`);
  console.log(`   Skipped            : ${stats.skipped}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
