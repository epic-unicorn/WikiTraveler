/**
 * scripts/seed.ts
 *
 * Seeds the database from the cached OSM fixture at
 * scripts/fixtures/eindhoven-osm.json. No hardcoded demo properties.
 *
 * Usage:
 *   pnpm db:seed           — ingest from fixture (fast, offline)
 *   pnpm osm:ingest        — fetch fresh data from Overpass + save fixture
 *   pnpm db:setup          — wipe DB, run migrations, then seed
 */

import { PrismaClient } from "@prisma/client";
import { existsSync } from "fs";
import { join } from "path";
import { fetchOverpassData, ingestOverpassResult } from "../apps/node/lib/overpass";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 WikiTraveler seed starting…");

  const NODE_ID = process.env.NODE_ID ?? "seed-script";

  // ── OSM fixture ingest ────────────────────────────────────────────────────
  const BBOX = process.env.OSM_BBOX ?? "51.39,5.42,51.49,5.52";
  const fixturePath = join(__dirname, "fixtures", `osm-${BBOX.replace(/[^0-9.]/g, "_")}.json`);
  if (existsSync(fixturePath)) {
    console.log(`🗺  OSM fixture found — ingesting ${fixturePath}…`);
    const result = await fetchOverpassData("", fixturePath);
    const stats = await ingestOverpassResult(result, `${NODE_ID}:osm`, prisma);
    console.log(`   Created: ${stats.created}  Updated: ${stats.updated}  Deduped: ${stats.deduped}  Skipped: ${stats.skipped}`);
    const count = await prisma.property.count();
    console.log(`✨ Seed complete — ${count} properties in database.`);
  } else {
    console.error(`❌ No OSM fixture at ${fixturePath}`);
    console.error("   Run `pnpm osm:ingest --fixture-only` once, or `pnpm osm:ingest` to fetch live data.");
    if (process.env.REQUIRE_OSM_FIXTURE === "true") {
      process.exit(1);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
