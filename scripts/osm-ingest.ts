/**
 * scripts/osm-ingest.ts
 *
 * Fetches accommodation data from Overpass for the admin-configured bbox
 * (tiled for large regions) and ingests into the database.
 *
 * Usage:
 *   pnpm osm:ingest                # fetch from Overpass, save + ingest
 *   pnpm osm:ingest --fixture-only # only save fixture, don't ingest
 *
 * Configure region in Admin (/stats) before running if the DB has no bbox yet.
 */

import { PrismaClient } from "@prisma/client";
import { join } from "path";
import { parseBbox, formatBbox } from "../apps/node/lib/bbox";
import { fetchOverpassData, ingestOverpassResult } from "../apps/node/lib/overpass";
import { buildIngestTiles } from "../apps/node/lib/tileRefine";

const prisma = new PrismaClient();

const NODE_ID = process.env.NODE_ID ?? "seed-script";
const TILE_DELAY_MS = parseInt(process.env.OSM_TILE_DELAY_MS ?? "3000", 10);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getBboxFromDb(): Promise<string> {
  const settings = await prisma.nodeSettings.findUnique({ where: { id: "default" } });
  if (!settings?.bbox) {
    throw new Error("No bbox configured. Set region in Admin (/stats) first.");
  }
  return settings.bbox;
}

async function main() {
  const fixtureOnly = process.argv.includes("--fixture-only");
  const BBOX = await getBboxFromDb();
  const parsed = parseBbox(BBOX);
  if (!parsed) throw new Error(`Invalid bbox in DB: ${BBOX}`);

  const tiles = await buildIngestTiles(parsed);
  const FIXTURE_PATH = join(__dirname, "fixtures", `osm-${BBOX.replace(/[^0-9.]/g, "_")}.json`);

  console.log(`🗺  OSM ingest starting…`);
  console.log(`   Bbox:    ${BBOX}`);
  console.log(`   Tiles:   ${tiles.length}`);
  console.log(`   Fixture: ${FIXTURE_PATH}`);

  let totalElements = 0;
  const agg = { total: 0, created: 0, updated: 0, deduped: 0, skipped: 0 };

  for (let i = 0; i < tiles.length; i++) {
    if (i > 0) await sleep(TILE_DELAY_MS);
    const tileBbox = formatBbox(tiles[i]!);
    console.log(`\n   Tile ${i + 1}/${tiles.length}: ${tileBbox}`);

    const tileFixture = tiles.length === 1 ? FIXTURE_PATH : undefined;
    const result = await fetchOverpassData(tileBbox, tileFixture);
    console.log(`   Elements fetched: ${result.elements.length}`);
    totalElements += result.elements.length;

    if (fixtureOnly) continue;

    const stats = await ingestOverpassResult(result, `${NODE_ID}:osm`, prisma);
    agg.total += stats.total;
    agg.created += stats.created;
    agg.updated += stats.updated;
    agg.deduped += stats.deduped;
    agg.skipped += stats.skipped;
  }

  if (fixtureOnly) {
    console.log("✨ Fixture saved. Skipping database ingest (--fixture-only).");
    await prisma.$disconnect();
    return;
  }

  await prisma.osmSyncState.upsert({
    where: { bbox: BBOX },
    update: { lastSync: new Date(), itemCount: totalElements },
    create: { bbox: BBOX, lastSync: new Date(), itemCount: totalElements },
  });

  await prisma.nodeSettings.update({
    where: { id: "default" },
    data: {
      lastIngestAt: new Date(),
      lastIngestCount: totalElements,
      configuredAt: new Date(),
    },
  });

  console.log(`\n✨ OSM ingest complete (${tiles.length} tiles):`);
  console.log(`   Total elements     : ${totalElements}`);
  console.log(`   Properties created : ${agg.created}`);
  console.log(`   Properties updated : ${agg.updated}`);
  console.log(`   Spatial deduped    : ${agg.deduped}`);
  console.log(`   Skipped            : ${agg.skipped}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
