/**
 * Tiled Overpass ingest (offline).
 *
 * Usage:
 *   pnpm node:ingest overpass --preset eindhoven
 *   pnpm node:ingest overpass --bbox "51.39,5.42,51.49,5.52"
 */

import { PrismaClient } from "@prisma/client";
import { join } from "path";
import { parseBbox, formatBbox } from "../apps/node/lib/bbox";
import { fetchOverpassData, ingestOverpassResult } from "../apps/node/lib/overpass";
import { buildIngestTiles } from "../apps/node/lib/tileRefine";
import { commitNodeBbox, recordIngestComplete } from "../apps/node/lib/nodeSettings";
import { deriveRegionLabel } from "../apps/node/lib/geocode";
import { getPresetById } from "../apps/node/lib/regionPresets";

const prisma = new PrismaClient();
const NODE_ID = process.env.NODE_ID ?? "cli-ingest";
const TILE_DELAY_MS = parseInt(process.env.OSM_TILE_DELAY_MS ?? "3000", 10);

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveBbox(): Promise<{ bbox: ReturnType<typeof parseBbox>; presetId?: string }> {
  const presetId = argValue("--preset");
  const bboxRaw = argValue("--bbox");

  if (presetId) {
    const preset = getPresetById(presetId);
    if (!preset) throw new Error(`Unknown preset: ${presetId}`);
    const bbox = parseBbox(preset.bbox);
    if (!bbox) throw new Error(`Invalid preset bbox: ${preset.bbox}`);
    return { bbox, presetId };
  }

  if (bboxRaw) {
    const bbox = parseBbox(bboxRaw);
    if (!bbox) throw new Error(`Invalid --bbox: ${bboxRaw}`);
    return { bbox };
  }

  const settings = await prisma.nodeSettings.findUnique({ where: { id: "default" } });
  if (settings?.bbox) {
    const bbox = parseBbox(settings.bbox);
    if (bbox) return { bbox, presetId: settings.presetId ?? undefined };
  }

  throw new Error("Provide --preset <id> or --bbox minLat,minLon,maxLat,maxLon");
}

async function main() {
  const { bbox, presetId } = await resolveBbox();
  if (!bbox) throw new Error("No bbox");

  const bboxStr = formatBbox(bbox);
  const regionLabel = await deriveRegionLabel(bbox, presetId);
  await commitNodeBbox(bbox, regionLabel, presetId);

  const tiles = await buildIngestTiles(bbox);
  const fixturePath = join(__dirname, "fixtures", `osm-${bboxStr.replace(/[^0-9.]/g, "_")}.json`);

  console.log(`OSM Overpass ingest`);
  console.log(`  Region: ${regionLabel}`);
  console.log(`  Bbox:   ${bboxStr}`);
  console.log(`  Tiles:  ${tiles.length}`);

  let totalElements = 0;
  const agg = { created: 0, updated: 0, deduped: 0, skipped: 0 };

  for (let i = 0; i < tiles.length; i++) {
    if (i > 0) await sleep(TILE_DELAY_MS);
    const tileBbox = formatBbox(tiles[i]!);
    console.log(`\n  Tile ${i + 1}/${tiles.length}: ${tileBbox}`);

    const tileFixture = tiles.length === 1 ? fixturePath : undefined;
    const result = await fetchOverpassData(tileBbox, tileFixture);
    totalElements += result.elements.length;

    const stats = await ingestOverpassResult(result, `${NODE_ID}:osm`, prisma);
    agg.created += stats.created;
    agg.updated += stats.updated;
    agg.deduped += stats.deduped;
    agg.skipped += stats.skipped;
  }

  await recordIngestComplete(totalElements);

  console.log(`\n✨ Done (${tiles.length} tiles)`);
  console.log(`   Elements: ${totalElements}`);
  console.log(`   Created:  ${agg.created}`);
  console.log(`   Updated:  ${agg.updated}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
