import type { NodeSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatBbox, parseBbox, type Bbox } from "@/lib/bbox";
import {
  findPresetByBbox,
  getPresetById,
  resolveRegionDisplayLabel,
} from "@/lib/regionPresets";

export type NodeSettingsDto = {
  bbox: string | null;
  region: string | null;
  presetId: string | null;
  configuredAt: string | null;
  lastIngestAt: string | null;
  lastIngestCount: number | null;
  openRegistration: boolean;
  auditedReimportPending: boolean;
  isConfigured: boolean;
};

const SETTINGS_ID = "default";

function toDto(row: NodeSettings): NodeSettingsDto {
  return {
    bbox: row.bbox,
    region: resolveRegionDisplayLabel(row.region, row.presetId, row.bbox),
    presetId: row.presetId,
    configuredAt: row.configuredAt?.toISOString() ?? null,
    lastIngestAt: row.lastIngestAt?.toISOString() ?? null,
    lastIngestCount: row.lastIngestCount,
    openRegistration: row.openRegistration,
    auditedReimportPending: row.auditedReimportPending,
    isConfigured: row.bbox != null && row.configuredAt != null,
  };
}

async function ensureSettings(): Promise<NodeSettings> {
  return prisma.nodeSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

async function repairPresetFromBbox(row: NodeSettings): Promise<NodeSettings> {
  if (row.presetId || !row.bbox) return row;
  const matched = findPresetByBbox(row.bbox);
  if (!matched) return row;
  return prisma.nodeSettings.update({
    where: { id: SETTINGS_ID },
    data: { presetId: matched.id, region: matched.label },
  });
}

export async function getNodeSettings(): Promise<NodeSettingsDto> {
  const row = await repairPresetFromBbox(await ensureSettings());
  return toDto(row);
}

export async function getNodeBbox(): Promise<string | null> {
  const row = await ensureSettings();
  return row.bbox;
}

export async function getNodeBboxParsed(): Promise<Bbox | null> {
  return parseBbox(await getNodeBbox());
}

export async function getNodeRegionLabel(): Promise<string> {
  const row = await repairPresetFromBbox(await ensureSettings());
  return resolveRegionDisplayLabel(row.region, row.presetId, row.bbox);
}

export async function updateNodeSettings(data: {
  bbox?: string | null;
  region?: string | null;
  presetId?: string | null;
  configuredAt?: Date | null;
  lastIngestAt?: Date | null;
  lastIngestCount?: number | null;
  openRegistration?: boolean;
  auditedReimportPending?: boolean;
}): Promise<NodeSettingsDto> {
  const row = await prisma.nodeSettings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });
  return toDto(row);
}

export async function commitNodeBbox(
  bbox: Bbox,
  region: string,
  presetId?: string | null
): Promise<NodeSettingsDto> {
  const effectivePresetId = presetId ?? findPresetByBbox(formatBbox(bbox))?.id ?? null;
  const regionLabel =
    effectivePresetId != null
      ? (getPresetById(effectivePresetId)?.label ?? region)
      : region;

  return updateNodeSettings({
    bbox: formatBbox(bbox),
    region: regionLabel,
    presetId: effectivePresetId,
    configuredAt: new Date(),
  });
}

export async function recordIngestComplete(elementCount: number): Promise<void> {
  const row = await ensureSettings();
  const bbox = row.bbox;
  if (!bbox) return;

  await prisma.nodeSettings.update({
    where: { id: SETTINGS_ID },
    data: { lastIngestAt: new Date(), lastIngestCount: elementCount },
  });

  await prisma.osmSyncState.upsert({
    where: { bbox },
    update: { lastSync: new Date(), itemCount: elementCount },
    create: { bbox, lastSync: new Date(), itemCount: elementCount },
  });
}

export async function getLastIngestAt(): Promise<Date | null> {
  const row = await ensureSettings();
  return row.lastIngestAt;
}

export async function getOpenRegistration(): Promise<boolean> {
  const row = await ensureSettings();
  return row.openRegistration;
}

export async function setAuditedReimportPending(pending: boolean): Promise<void> {
  await prisma.nodeSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { auditedReimportPending: pending },
    create: { id: SETTINGS_ID, auditedReimportPending: pending },
  });
}
