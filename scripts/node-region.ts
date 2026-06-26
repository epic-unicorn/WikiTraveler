/**
 * Set NodeSettings region from CLI.
 *
 * Usage:
 *   pnpm node:region --preset eindhoven
 *   pnpm node:region --bbox "50.75,3.36,53.55,7.23" --label "Netherlands"
 */

import { PrismaClient } from "@prisma/client";
import { parseBbox } from "../apps/node/lib/bbox";
import { deriveRegionLabel } from "../apps/node/lib/geocode";
import { commitNodeBbox } from "../apps/node/lib/nodeSettings";
import { getPresetById } from "../apps/node/lib/regionPresets";

const prisma = new PrismaClient();

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const presetId = argValue("--preset");
  const bboxRaw = argValue("--bbox");
  const label = argValue("--label");

  let bbox = bboxRaw ? parseBbox(bboxRaw) : null;
  let effectivePresetId = presetId;

  if (presetId) {
    const preset = getPresetById(presetId);
    if (!preset) throw new Error(`Unknown preset: ${presetId}`);
    bbox = parseBbox(preset.bbox);
    effectivePresetId = presetId;
  }

  if (!bbox) {
    throw new Error("Provide --preset <id> or --bbox minLat,minLon,maxLat,maxLon");
  }

  const regionLabel = label ?? (await deriveRegionLabel(bbox, effectivePresetId));
  await commitNodeBbox(bbox, regionLabel, effectivePresetId);

  console.log(`✓ Region set: ${regionLabel}`);
  console.log(`  bbox: ${bbox.join(",")}`);
  if (effectivePresetId) console.log(`  preset: ${effectivePresetId}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
