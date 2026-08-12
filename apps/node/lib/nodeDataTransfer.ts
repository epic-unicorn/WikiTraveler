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

export interface ExportFilter {
  /**
   * When provided, only export properties whose osmId is in this set (plus their
   * facts and metadata overrides). Used to scope the bundled sample to a single
   * region regardless of what else lives in the source database.
   */
  osmIds?: Iterable<string>;
}

export async function buildExportPayload(filter?: ExportFilter): Promise<ExportPayload> {
  const osmIdFilter = filter?.osmIds ? [...new Set(filter.osmIds)] : null;

  const properties = await prisma.property.findMany({
    where: osmIdFilter ? { osmId: { in: osmIdFilter } } : undefined,
    orderBy: { createdAt: "asc" },
  });
  const propertyIds = properties.map((p) => p.id);
  const propertyCanonicalIds = properties.map((p) => p.canonicalId);

  const [facts, metadataOverrides] = await Promise.all([
    prisma.accessibilityFact.findMany({
      where: osmIdFilter ? { propertyId: { in: propertyIds } } : undefined,
      orderBy: { timestamp: "asc" },
    }),
    prisma.propertyMetadataOverride.findMany({
      where: osmIdFilter ? { canonicalId: { in: propertyCanonicalIds } } : undefined,
      orderBy: { timestamp: "asc" },
    }),
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

export interface ImportOptions {
  /** Only import the first N properties (and their facts). Useful for smoke tests. */
  limit?: number;
  onProgress?: (message: string) => void;
}

const PROPERTY_BATCH = 500;
const FACT_BATCH = 1000;
const ID_IN_CHUNK = 20000;

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error("chunkArray size must be > 0");
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function isTransientDbError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code?: unknown }).code ?? "") : "";
  const message = err instanceof Error ? err.message : String(err);
  return (
    code === "P1017" ||
    code === "P1001" ||
    code === "P1002" ||
    /closed the connection|Can't reach database|Connection reset|ECONNRESET|ETIMEDOUT/i.test(
      message
    )
  );
}

async function withDbRetry<T>(label: string, fn: () => Promise<T>, onProgress?: (m: string) => void): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientDbError(err) || attempt === 5) throw err;
      const waitMs = attempt * 1500;
      onProgress?.(
        `${label}: connection error (attempt ${attempt}/5), retrying in ${waitMs}ms…`
      );
      await new Promise((r) => setTimeout(r, waitMs));
      try {
        await prisma.$connect();
      } catch {
        // reconnect best-effort; next attempt will surface the real error
      }
    }
  }
  throw lastErr;
}

/**
 * Slice a full export to the first `limit` properties (and related facts / overrides).
 * Keeps import smoke tests fast against local Postgres or Neon.
 */
export function limitExportPayload(payload: ExportPayload, limit: number): ExportPayload {
  if (!Number.isFinite(limit) || limit <= 0) return payload;
  const properties = payload.properties.slice(0, limit);
  const propertyIds = new Set(properties.map((p) => p.id));
  const canonicalIds = new Set(properties.map((p) => p.canonicalId));
  return {
    ...payload,
    properties,
    facts: payload.facts.filter((f) => propertyIds.has(f.propertyId)),
    metadataOverrides: (payload.metadataOverrides ?? []).filter((o) =>
      canonicalIds.has(o.canonicalId)
    ),
  };
}

/**
 * Bulk import for large gzip exports.
 *
 * Uses createMany + skipDuplicates (batched) instead of per-row upserts so West-Europe
 * scale imports finish in minutes rather than hours. Safe to re-run: already-imported
 * rows are skipped; VERIFIED/CONFIRMED facts are not downgraded.
 */
export async function importExportPayload(
  payload: ExportPayload,
  options: ImportOptions = {}
): Promise<ImportResult> {
  if (!Array.isArray(payload.properties) || !Array.isArray(payload.facts)) {
    throw new Error("Invalid export format — missing properties or facts arrays");
  }

  const onProgress = options.onProgress ?? (() => {});
  const working =
    options.limit != null ? limitExportPayload(payload, options.limit) : payload;

  onProgress(
    `Importing ${working.properties.length} properties, ${working.facts.length} facts` +
      (options.limit != null ? ` (limit=${options.limit})` : "")
  );

  // 1) Insert properties in batches (skip rows that already exist by unique key)
  let propertiesInserted = 0;
  const propertyChunks = chunkArray(working.properties, PROPERTY_BATCH);
  for (let i = 0; i < propertyChunks.length; i++) {
    const chunk = propertyChunks[i]!;
    const result = await withDbRetry(
      `properties batch ${i + 1}/${propertyChunks.length}`,
      () =>
        prisma.property.createMany({
          data: chunk.map((p) => ({
            canonicalId: p.canonicalId,
            name: p.name,
            location: p.location,
            lat: p.lat,
            lon: p.lon,
            osmId: p.osmId,
            wheelmapId: p.wheelmapId,
            dataSource: p.dataSource ?? "IMPORTED_OSM",
          })),
          skipDuplicates: true,
        }),
      onProgress
    );
    propertiesInserted += result.count;
    if ((i + 1) % 10 === 0 || i === propertyChunks.length - 1) {
      onProgress(
        `Properties: batch ${i + 1}/${propertyChunks.length} (${propertiesInserted} newly inserted)`
      );
    }
  }

  // 2) Map export property ids → local ids via canonicalId
  const idMap = new Map<string, string>();
  const exportByCanonical = new Map(working.properties.map((p) => [p.canonicalId, p.id]));
  const canonicalIds = working.properties.map((p) => p.canonicalId);
  for (const idChunk of chunkArray(canonicalIds, ID_IN_CHUNK)) {
    const rows = await withDbRetry(
      "property id map",
      () =>
        prisma.property.findMany({
          where: { canonicalId: { in: idChunk } },
          select: { id: true, canonicalId: true },
        }),
      onProgress
    );
    for (const row of rows) {
      const exportId = exportByCanonical.get(row.canonicalId);
      if (exportId) idMap.set(exportId, row.id);
    }
  }
  onProgress(`Mapped ${idMap.size} properties to local ids`);

  // 3) Protect VERIFIED/CONFIRMED facts from downgrade
  let factsProtected = 0;
  const protectedMap = new Map<string, Set<string>>();
  const localIds = [...idMap.values()];
  for (const idChunk of chunkArray(localIds, ID_IN_CHUNK)) {
    const existingFacts = await withDbRetry(
      "protected facts lookup",
      () =>
        prisma.accessibilityFact.findMany({
          where: {
            propertyId: { in: idChunk },
            tier: { in: ["VERIFIED", "CONFIRMED"] },
          },
          select: { propertyId: true, fieldName: true },
        }),
      onProgress
    );
    for (const f of existingFacts) {
      if (!protectedMap.has(f.propertyId)) protectedMap.set(f.propertyId, new Set());
      protectedMap.get(f.propertyId)!.add(f.fieldName);
    }
  }

  // 4) Insert facts in batches
  const factsToInsert: Array<{
    propertyId: string;
    fieldName: string;
    value: string;
    tier: Tier;
    sourceType: SourceType;
    sourceNodeId: string;
    submittedBy: string | null;
    signatureHash: string | null;
    timestamp: Date;
    scopeKey: string;
  }> = [];

  for (const f of working.facts) {
    const localPropertyId = idMap.get(f.propertyId);
    if (!localPropertyId) continue;
    if (protectedMap.get(localPropertyId)?.has(f.fieldName)) {
      factsProtected++;
      continue;
    }
    factsToInsert.push({
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
    });
  }

  let factsImported = 0;
  const factChunks = chunkArray(factsToInsert, FACT_BATCH);
  for (let i = 0; i < factChunks.length; i++) {
    const chunk = factChunks[i]!;
    const result = await withDbRetry(
      `facts batch ${i + 1}/${factChunks.length}`,
      () =>
        prisma.accessibilityFact.createMany({
          data: chunk,
          skipDuplicates: true,
        }),
      onProgress
    );
    factsImported += result.count;
    if ((i + 1) % 20 === 0 || i === factChunks.length - 1) {
      onProgress(
        `Facts: batch ${i + 1}/${factChunks.length} (${factsImported} newly inserted)`
      );
    }
  }

  const incomingOverrides: PropertyMetadataOverride[] = (working.metadataOverrides ?? []).map(
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
