/**
 * Geofabrik PBF or GeoJSON import (offline).
 *
 * Usage:
 *   pnpm node:ingest pbf --region netherlands
 *   pnpm node:ingest geojson --file ./export.geojsonseq --bbox "..."
 */

import { PrismaClient } from "@prisma/client";
import { formatBbox, parseBbox } from "../apps/node/lib/bbox";
import { getGeofabrikRegion } from "../apps/node/lib/geofabrik";
import { importGeoJsonFile, importGeofabrikRegion } from "../apps/node/lib/pbfImport";
import { commitNodeBbox, recordIngestComplete } from "../apps/node/lib/nodeSettings";
import { deriveRegionLabel } from "../apps/node/lib/geocode";
import { getPresetById } from "../apps/node/lib/regionPresets";

const prisma = new PrismaClient();
const NODE_ID = process.env.NODE_ID ?? "pbf-import-cli";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

async function resolveBbox(): Promise<{ bbox: NonNullable<ReturnType<typeof parseBbox>>; presetId?: string }> {
  const presetId = argValue("--preset");
  const bboxRaw = argValue("--bbox");

  if (presetId) {
    const preset = getPresetById(presetId);
    if (!preset) throw new Error(`Unknown preset: ${presetId}`);
    const bbox = parseBbox(preset.bbox);
    if (!bbox) throw new Error(`Invalid preset bbox`);
    return { bbox, presetId };
  }

  if (bboxRaw) {
    const bbox = parseBbox(bboxRaw);
    if (!bbox) throw new Error(`Invalid --bbox`);
    return { bbox };
  }

  const settings = await prisma.nodeSettings.findUnique({ where: { id: "default" } });
  if (settings?.bbox) {
    const bbox = parseBbox(settings.bbox);
    if (bbox) return { bbox, presetId: settings.presetId ?? undefined };
  }

  throw new Error("Provide --preset, --bbox, or configure region in DB");
}

async function main() {
  const regionId = argValue("--region");
  const geojson = argValue("--geojson") ?? argValue("--file");
  const { bbox, presetId } = await resolveBbox();

  const regionLabel = await deriveRegionLabel(bbox, presetId);
  await commitNodeBbox(bbox, regionLabel, presetId);

  let result: { elements: number; stats: { created: number; updated: number; skipped: number } };

  if (geojson) {
    console.log(`GeoJSON import: ${geojson}`);
    result = await importGeoJsonFile(geojson, bbox, `${NODE_ID}:osm`, prisma);
  } else if (regionId) {
    const region = getGeofabrikRegion(regionId);
    if (!region) throw new Error(`Unknown --region ${regionId}`);
    console.log(`Geofabrik import: ${regionId}`);
    result = await importGeofabrikRegion({
      geofabrikId: regionId,
      bbox,
      sourceNodeId: `${NODE_ID}:osm`,
      prisma,
      onProgress: (msg, p) => console.log(p != null ? `[${p}%] ${msg}` : msg),
    });
  } else {
    throw new Error("Provide --region <id> or --file <geojson>");
  }

  await recordIngestComplete(result.elements);

  console.log("\n✨ Import complete");
  console.log(`   Elements: ${result.elements}`);
  console.log(`   Created:  ${result.stats.created}`);
  console.log(`   Updated:  ${result.stats.updated}`);
  console.log(`   Bbox:     ${formatBbox(bbox)}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
