/**
 * scripts/seed.ts
 *
 * Seeds the database from a cached OSM fixture for the admin-configured bbox.
 * Prefer configuring region in Admin (/stats) and using ingest from the UI.
 *
 * Usage:
 *   pnpm db:seed    — ingest from fixture (fast, offline; bbox from DB)
 *   pnpm osm:ingest — fetch fresh data from Overpass + save fixture
 */

import { PrismaClient } from "@prisma/client";
import { existsSync } from "fs";
import { join } from "path";
import { fetchOverpassData, ingestOverpassResult } from "../apps/node/lib/overpass";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 WikiTraveler seed starting…");

  const NODE_ID = process.env.NODE_ID ?? "seed-script";
  const settings = await prisma.nodeSettings.findUnique({ where: { id: "default" } });
  const BBOX = settings?.bbox;

  if (!BBOX) {
    console.log("ℹ️  No region configured in DB — skipping OSM seed.");
    console.log("   Configure region in Admin (/stats) or set NodeSettings.bbox manually.");
    await prisma.$disconnect();
    return;
  }

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
    console.error("   Configure region in Admin, run ingest, or `pnpm osm:ingest --fixture-only`.");
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
