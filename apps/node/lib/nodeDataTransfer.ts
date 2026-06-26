import { prisma } from "@/lib/prisma";
import { applyIncomingMetadataOverrides } from "@/lib/propertyMetadata";
import type { PropertyMetadataOverride, Tier, SourceType } from "@wikitraveler/core";

export interface ExportProperty {
  id: string;
  canonicalId: string;
  name: string;
  location: string;
  lat: number | null;
  lon: number | null;
  dataSource: string;
  osmId: string | null;
  wheelmapId: string | null;
}

export interface ExportFact {
  propertyId: string;
  fieldName: string;
  value: string;
  tier: string;
  sourceType: string;
  sourceNodeId: string;
  submittedBy: string | null;
  signatureHash: string | null;
  timestamp: string;
  scopeKey?: string;
}

export interface ExportMetadataOverride {
  canonicalId: string;
  fieldName: string;
  value: string;
  sourceType: string;
  sourceNodeId: string;
  submittedBy: string | null;
  signatureHash: string | null;
  timestamp: string;
  clearedAt: string | null;
}

export interface ExportPayload {
  schemaVersion: number;
  exportedAt: string;
  properties: ExportProperty[];
  facts: ExportFact[];
  metadataOverrides?: ExportMetadataOverride[];
}

export async function buildExportPayload(): Promise<ExportPayload> {
  const [properties, facts, metadataOverrides] = await Promise.all([
    prisma.property.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.accessibilityFact.findMany({ orderBy: { timestamp: "asc" } }),
    prisma.propertyMetadataOverride.findMany({ orderBy: { timestamp: "asc" } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: 2,
    properties: properties.map((p) => ({
      id: p.id,
      canonicalId: p.canonicalId,
      name: p.name,
      location: p.location,
      lat: p.lat,
      lon: p.lon,
      dataSource: p.dataSource,
      osmId: p.osmId,
      wheelmapId: p.wheelmapId,
    })),
    facts: facts.map((f) => ({
      propertyId: f.propertyId,
      fieldName: f.fieldName,
      value: f.value,
      tier: f.tier,
      sourceType: f.sourceType,
      sourceNodeId: f.sourceNodeId,
      submittedBy: f.submittedBy,
      signatureHash: f.signatureHash,
      timestamp: f.timestamp.toISOString(),
      scopeKey: f.scopeKey,
    })),
    metadataOverrides: metadataOverrides.map((o) => ({
      canonicalId: o.canonicalId,
      fieldName: o.fieldName,
      value: o.value,
      sourceType: o.sourceType,
      sourceNodeId: o.sourceNodeId,
      submittedBy: o.submittedBy,
      signatureHash: o.signatureHash,
      timestamp: o.timestamp.toISOString(),
      clearedAt: o.clearedAt?.toISOString() ?? null,
    })),
  };
}

export interface ImportResult {
  propertiesUpserted: number;
  factsImported: number;
  factsProtected: number;
  metadataOverridesImported: number;
}

export async function importExportPayload(payload: ExportPayload): Promise<ImportResult> {
  if (!Array.isArray(payload.properties) || !Array.isArray(payload.facts)) {
    throw new Error("Invalid export format — missing properties or facts arrays");
  }

  const idMap = new Map<string, string>();

  for (const p of payload.properties) {
    const local = await prisma.property.upsert({
      where: { canonicalId: p.canonicalId },
      update: {
        name: p.name,
        location: p.location,
        lat: p.lat,
        lon: p.lon,
        ...(p.osmId ? { osmId: p.osmId } : {}),
        ...(p.wheelmapId ? { wheelmapId: p.wheelmapId } : {}),
      },
      create: {
        canonicalId: p.canonicalId,
        name: p.name,
        location: p.location,
        lat: p.lat,
        lon: p.lon,
        osmId: p.osmId,
        wheelmapId: p.wheelmapId,
        dataSource: p.dataSource ?? "IMPORTED_OSM",
      },
      select: { id: true },
    });
    idMap.set(p.id, local.id);
  }

  let factsImported = 0;
  let factsProtected = 0;

  const protectedMap = new Map<string, Set<string>>();
  const localIds = [...idMap.values()];
  const existingFacts = await prisma.accessibilityFact.findMany({
    where: {
      propertyId: { in: localIds },
      tier: { in: ["VERIFIED", "CONFIRMED"] },
    },
    select: { propertyId: true, fieldName: true },
  });
  for (const f of existingFacts) {
    if (!protectedMap.has(f.propertyId)) protectedMap.set(f.propertyId, new Set());
    protectedMap.get(f.propertyId)!.add(f.fieldName);
  }

  for (const f of payload.facts) {
    const localPropertyId = idMap.get(f.propertyId);
    if (!localPropertyId) continue;

    if (protectedMap.get(localPropertyId)?.has(f.fieldName)) {
      factsProtected++;
      continue;
    }

    await prisma.accessibilityFact.upsert({
      where: {
        propertyId_fieldName_sourceNodeId_scopeKey: {
          propertyId: localPropertyId,
          fieldName: f.fieldName,
          sourceNodeId: f.sourceNodeId,
          scopeKey: f.scopeKey ?? "property",
        },
      },
      update: { value: f.value, tier: f.tier as Tier, timestamp: new Date(f.timestamp) },
      create: {
        propertyId: localPropertyId,
        fieldName: f.fieldName,
        value: f.value,
        tier: f.tier as Tier,
        sourceType: f.sourceType as SourceType,
        sourceNodeId: f.sourceNodeId,
        submittedBy: f.submittedBy,
        signatureHash: f.signatureHash,
        timestamp: new Date(f.timestamp),
        scopeKey: f.scopeKey ?? "property",
      },
    });
    factsImported++;
  }

  const incomingOverrides: PropertyMetadataOverride[] = (payload.metadataOverrides ?? []).map(
    (o) => ({
      canonicalId: o.canonicalId,
      fieldName: o.fieldName as PropertyMetadataOverride["fieldName"],
      value: o.value,
      sourceType: o.sourceType as SourceType,
      sourceNodeId: o.sourceNodeId,
      submittedBy: o.submittedBy,
      signatureHash: o.signatureHash,
      timestamp: o.timestamp,
      clearedAt: o.clearedAt,
    })
  );
  const metadataOverridesImported = await applyIncomingMetadataOverrides(incomingOverrides);

  return {
    propertiesUpserted: idMap.size,
    factsImported,
    factsProtected,
    metadataOverridesImported,
  };
}
