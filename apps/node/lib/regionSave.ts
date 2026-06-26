import { prisma } from "@/lib/prisma";
import { classifyBboxChange, formatBbox, parseBbox, type Bbox } from "@/lib/bbox";
import { deriveRegionLabel } from "@/lib/geocode";
import { getNodeBboxParsed, commitNodeBbox, setAuditedReimportPending } from "@/lib/nodeSettings";
import { findPresetByBbox } from "@/lib/regionPresets";
import { countPropertiesOutsideBbox, purgeGossipOutsideBbox, purgeOutsideBbox } from "@/lib/regionPurge";

export interface RegionSavePlan {
  changeType: ReturnType<typeof classifyBboxChange>;
  requiresExport: boolean;
  propertiesToRemove: number;
  regionLabel: string;
}

export async function planRegionSave(
  proposedBbox: Bbox,
  presetId?: string | null
): Promise<RegionSavePlan> {
  const current = await getNodeBboxParsed();
  const changeType = classifyBboxChange(current, proposedBbox);
  const propertiesToRemove =
    changeType === "shrink" || changeType === "expand" || changeType === "move"
      ? await countPropertiesOutsideBbox(prisma, proposedBbox)
      : 0;
  const regionLabel = await deriveRegionLabel(proposedBbox, presetId);

  return {
    changeType,
    requiresExport: changeType === "move",
    propertiesToRemove,
    regionLabel,
  };
}

export async function saveRegionBbox(
  bbox: Bbox,
  options: { presetId?: string | null; exportConfirmed?: boolean } = {}
): Promise<{ changeType: string; propertiesRemoved: number }> {
  const plan = await planRegionSave(bbox, options.presetId);

  if (plan.requiresExport && !options.exportConfirmed) {
    throw new Error("Export audited data and confirm before moving to a new region.");
  }

  const effectivePresetId =
    options.presetId ?? findPresetByBbox(formatBbox(bbox))?.id ?? undefined;

  await commitNodeBbox(bbox, plan.regionLabel, effectivePresetId);

  let propertiesRemoved = 0;
  if (plan.changeType === "shrink") {
    propertiesRemoved = await purgeOutsideBbox(prisma, bbox);
    await purgeGossipOutsideBbox(prisma, bbox);
    await setAuditedReimportPending(false);
  } else if (plan.changeType === "move") {
    await setAuditedReimportPending(true);
  } else {
    await setAuditedReimportPending(false);
  }

  return { changeType: plan.changeType, propertiesRemoved };
}

export function parseRegionBbox(raw: string): Bbox | null {
  return parseBbox(raw);
}
