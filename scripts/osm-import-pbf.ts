/**
 * Import accommodation from a Geofabrik .osm.pbf extract.
 *
 * Requires osmium-tool (Linux/macOS) or Docker on Windows:
 *   pnpm osm:import-pbf:docker -- --region france
 *
 * Usage:
 *   pnpm osm:import-pbf --region france
 *   pnpm osm:import-pbf --region germany
 *   pnpm osm:import-pbf --geojson ./path/to/export.geojsonseq
 *
 * Uses bbox from NodeSettings in DB. Configure region in Admin first.
 */

import { PrismaClient } from "@prisma/client";
import { formatBbox, parseBbox } from "../apps/node/lib/bbox";
import { getGeofabrikRegion } from "../apps/node/lib/geofabrik";
import { importGeoJsonFile, importGeofabrikRegion } from "../apps/node/lib/pbfImport";
import { bboxesEqual } from "../apps/node/lib/regionPresets";

const prisma = new PrismaClient();
const NODE_ID = process.env.NODE_ID ?? "pbf-import-script";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const regionId = argValue("--region");
  const geojson = argValue("--geojson");

  const settings = await prisma.nodeSettings.findUnique({ where: { id: "default" } });
  if (!settings?.bbox) {
    throw new Error("No bbox in NodeSettings. Configure region in Admin (/stats) first.");
  }

  const bbox = parseBbox(settings.bbox);
  if (!bbox) throw new Error(`Invalid bbox in DB: ${settings.bbox}`);

  let result: { elements: number; stats: { created: number; updated: number; skipped: number } };

  if (geojson) {
    console.log(`Importing from GeoJSON: ${geojson}`);
    result = await importGeoJsonFile(geojson, bbox, `${NODE_ID}:osm`, prisma);
  } else if (regionId) {
    const region = getGeofabrikRegion(regionId);
    if (!region) {
      throw new Error(`Unknown --region ${regionId}. See apps/node/lib/geofabrik.ts`);
    }
    if (!bboxesEqual(bbox, region.bbox)) {
      throw new Error(
        `Admin bbox does not match Geofabrik region "${regionId}".\n` +
          `  Current : ${formatBbox(bbox)}\n` +
          `  Expected: ${formatBbox(region.bbox)} (${region.label})\n` +
          `Open Admin (/stats) → Region & OSM ingest → select "${region.label}" → Preview → Save region only, then retry.`
      );
    }
    console.log(`Geofabrik import: ${regionId} → bbox ${settings.bbox}`);
    result = await importGeofabrikRegion({
      geofabrikId: regionId,
      bbox,
      sourceNodeId: `${NODE_ID}:osm`,
      prisma,
      onProgress: (msg, p) => console.log(p != null ? `[${p}%] ${msg}` : msg),
    });
  } else {
    throw new Error("Provide --region <id> or --geojson <path>");
  }

  await prisma.nodeSettings.update({
    where: { id: "default" },
    data: {
      lastIngestAt: new Date(),
      lastIngestCount: result.elements,
      configuredAt: new Date(),
    },
  });

  console.log("\n✨ PBF import complete:");
  console.log(`   Elements processed : ${result.elements}`);
  console.log(`   Properties created : ${result.stats.created}`);
  console.log(`   Properties updated : ${result.stats.updated}`);
  console.log(`   Skipped            : ${result.stats.skipped}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
