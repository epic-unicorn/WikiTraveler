import { prisma } from "@/lib/prisma";
import { NODE_ID } from "@/lib/nodeInfo";
import {
  mergeMetadataOverrides,
  resolveEffectiveMetadata,
  type BasePropertyMetadata,
  type EffectivePropertyMetadata,
  type PropertyMetadataFieldName,
  type PropertyMetadataOverride,
  PROPERTY_METADATA_FIELDS,
} from "@wikitraveler/core";
import type { SourceType } from "@wikitraveler/core";

export type { PropertyMetadataFieldName, PropertyMetadataOverride };

export interface PropertyRowForMetadata {
  id: string;
  canonicalId: string;
  name: string;
  location: string;
  lat: number | null;
  lon: number | null;
}

export interface ResolvedPropertyMetadata {
  base: BasePropertyMetadata;
  effective: EffectivePropertyMetadata;
  overrides: PropertyMetadataOverride[];
}

function toTransport(
  row: {
    canonicalId: string;
    fieldName: string;
    value: string;
    sourceType: string;
    sourceNodeId: string;
    submittedBy: string | null;
    signatureHash: string | null;
    timestamp: Date;
    clearedAt: Date | null;
  }
): PropertyMetadataOverride {
  return {
    canonicalId: row.canonicalId,
    fieldName: row.fieldName as PropertyMetadataFieldName,
    value: row.value,
    sourceType: row.sourceType as SourceType,
    sourceNodeId: row.sourceNodeId,
    submittedBy: row.submittedBy,
    timestamp: row.timestamp.toISOString(),
    signatureHash: row.signatureHash,
    clearedAt: row.clearedAt?.toISOString() ?? null,
  };
}

export function baseFromProperty(p: PropertyRowForMetadata): BasePropertyMetadata {
  return {
    name: p.name,
    location: p.location,
    lat: p.lat,
    lon: p.lon,
  };
}

export async function loadOverridesForCanonicalIds(
  canonicalIds: string[]
): Promise<Map<string, PropertyMetadataOverride[]>> {
  const map = new Map<string, PropertyMetadataOverride[]>();
  if (canonicalIds.length === 0) return map;

  const rows = await prisma.propertyMetadataOverride.findMany({
    where: { canonicalId: { in: canonicalIds } },
    orderBy: { timestamp: "asc" },
  });

  for (const row of rows) {
    const list = map.get(row.canonicalId) ?? [];
    list.push(toTransport(row));
    map.set(row.canonicalId, list);
  }
  return map;
}

export function resolveOne(
  property: PropertyRowForMetadata,
  overrides: PropertyMetadataOverride[]
): ResolvedPropertyMetadata {
  const base = baseFromProperty(property);
  return {
    base,
    effective: resolveEffectiveMetadata(base, overrides),
    overrides,
  };
}

export async function resolveEffectiveProperties<T extends PropertyRowForMetadata>(
  properties: T[]
): Promise<Array<T & ResolvedPropertyMetadata>> {
  if (properties.length === 0) return [];
  const overrideMap = await loadOverridesForCanonicalIds(
    properties.map((p) => p.canonicalId)
  );
  return properties.map((p) => {
    const overrides = overrideMap.get(p.canonicalId) ?? [];
    const resolved = resolveOne(p, overrides);
    return {
      ...p,
      name: resolved.effective.name,
      location: resolved.effective.location,
      lat: resolved.effective.lat,
      lon: resolved.effective.lon,
      base: resolved.base,
      effective: resolved.effective,
      overrides: resolved.overrides,
    };
  });
}

function fieldValueFromEffective(
  field: PropertyMetadataFieldName,
  effective: { name: string; location: string; lat: number | null; lon: number | null }
): string {
  switch (field) {
    case "name":
      return effective.name;
    case "location":
      return effective.location;
    case "lat":
      return effective.lat != null ? String(effective.lat) : "";
    case "lon":
      return effective.lon != null ? String(effective.lon) : "";
  }
}

export async function upsertLocalMetadataOverrides(options: {
  property: PropertyRowForMetadata;
  fields: Partial<Record<PropertyMetadataFieldName, string>>;
  submittedBy?: string | null;
}): Promise<PropertyMetadataOverride[]> {
  const { property, fields, submittedBy } = options;
  const base = baseFromProperty(property);
  const now = new Date();
  const sourceNodeId = NODE_ID;
  const results: PropertyMetadataOverride[] = [];

  for (const fieldName of PROPERTY_METADATA_FIELDS) {
    if (!(fieldName in fields)) continue;
    const newValue = fields[fieldName]!.trim();
    const baseValue =
      fieldName === "name"
        ? base.name
        : fieldName === "location"
          ? base.location
          : fieldName === "lat"
            ? (base.lat != null ? String(base.lat) : "")
            : (base.lon != null ? String(base.lon) : "");

    if (newValue === baseValue) {
      const row = await prisma.propertyMetadataOverride.upsert({
        where: {
          canonicalId_fieldName_sourceNodeId: {
            canonicalId: property.canonicalId,
            fieldName,
            sourceNodeId,
          },
        },
        update: {
          value: "",
          clearedAt: now,
          timestamp: now,
          submittedBy: submittedBy ?? null,
        },
        create: {
          propertyId: property.id,
          canonicalId: property.canonicalId,
          fieldName,
          value: "",
          sourceType: "AUDITOR",
          sourceNodeId,
          submittedBy: submittedBy ?? null,
          clearedAt: now,
        },
      });
      results.push(toTransport(row));
    } else {
      const row = await prisma.propertyMetadataOverride.upsert({
        where: {
          canonicalId_fieldName_sourceNodeId: {
            canonicalId: property.canonicalId,
            fieldName,
            sourceNodeId,
          },
        },
        update: {
          value: newValue,
          clearedAt: null,
          timestamp: now,
          submittedBy: submittedBy ?? null,
        },
        create: {
          propertyId: property.id,
          canonicalId: property.canonicalId,
          fieldName,
          value: newValue,
          sourceType: "AUDITOR",
          sourceNodeId,
          submittedBy: submittedBy ?? null,
        },
      });
      results.push(toTransport(row));
    }
  }

  return results;
}

export async function resetLocalMetadataFields(options: {
  property: PropertyRowForMetadata;
  fields: PropertyMetadataFieldName[];
  submittedBy?: string | null;
}): Promise<PropertyMetadataOverride[]> {
  const entries = Object.fromEntries(
    options.fields.map((f) => {
      const base = baseFromProperty(options.property);
      return [f, fieldValueFromEffective(f, base)];
    })
  ) as Partial<Record<PropertyMetadataFieldName, string>>;
  return upsertLocalMetadataOverrides({
    property: options.property,
    fields: entries,
    submittedBy: options.submittedBy,
  });
}

export async function applyIncomingMetadataOverrides(
  incoming: PropertyMetadataOverride[]
): Promise<number> {
  if (incoming.length === 0) return 0;

  const canonicalIds = [...new Set(incoming.map((o) => o.canonicalId))];
  const properties = await prisma.property.findMany({
    where: { canonicalId: { in: canonicalIds } },
    select: { id: true, canonicalId: true },
  });
  const propertyIdByCanonical = new Map(properties.map((p) => [p.canonicalId, p.id]));

  const existingRows = await prisma.propertyMetadataOverride.findMany({
    where: { canonicalId: { in: canonicalIds } },
  });
  const existing = existingRows.map(toTransport);
  const merged = mergeMetadataOverrides(existing, incoming);

  let applied = 0;
  for (const o of merged) {
    const propertyId = propertyIdByCanonical.get(o.canonicalId);
    if (!propertyId) continue;

    const incomingMatch = incoming.find(
      (i) =>
        i.canonicalId === o.canonicalId &&
        i.fieldName === o.fieldName &&
        i.sourceNodeId === o.sourceNodeId
    );
    if (!incomingMatch) continue;

    await prisma.propertyMetadataOverride.upsert({
      where: {
        canonicalId_fieldName_sourceNodeId: {
          canonicalId: o.canonicalId,
          fieldName: o.fieldName,
          sourceNodeId: o.sourceNodeId,
        },
      },
      update: {
        value: o.value,
        sourceType: o.sourceType,
        submittedBy: o.submittedBy,
        signatureHash: o.signatureHash,
        timestamp: new Date(o.timestamp),
        clearedAt: o.clearedAt ? new Date(o.clearedAt) : null,
      },
      create: {
        propertyId,
        canonicalId: o.canonicalId,
        fieldName: o.fieldName,
        value: o.value,
        sourceType: o.sourceType,
        sourceNodeId: o.sourceNodeId,
        submittedBy: o.submittedBy,
        signatureHash: o.signatureHash,
        timestamp: new Date(o.timestamp),
        clearedAt: o.clearedAt ? new Date(o.clearedAt) : null,
      },
    });
    applied++;
  }
  return applied;
}

export async function loadOverridesChangedSince(since: Date): Promise<PropertyMetadataOverride[]> {
  const rows = await prisma.propertyMetadataOverride.findMany({
    where: { timestamp: { gt: since } },
    orderBy: { timestamp: "asc" },
  });
  return rows.map(toTransport);
}

export type MetadataFieldProvenance = {
  fieldName: PropertyMetadataFieldName;
  source: "base" | "local" | "peer";
  sourceNodeId?: string;
  timestamp?: string;
  baseValue: string;
  effectiveValue: string;
};

function effectiveFieldString(
  fieldName: PropertyMetadataFieldName,
  effective: EffectivePropertyMetadata
): string {
  switch (fieldName) {
    case "name":
      return effective.name;
    case "location":
      return effective.location;
    case "lat":
      return effective.lat != null ? String(effective.lat) : "";
    case "lon":
      return effective.lon != null ? String(effective.lon) : "";
  }
}

function baseFieldString(
  fieldName: PropertyMetadataFieldName,
  base: BasePropertyMetadata
): string {
  switch (fieldName) {
    case "name":
      return base.name;
    case "location":
      return base.location;
    case "lat":
      return base.lat != null ? String(base.lat) : "";
    case "lon":
      return base.lon != null ? String(base.lon) : "";
  }
}

function pickActiveFieldOverride(
  overrides: PropertyMetadataOverride[],
  fieldName: PropertyMetadataFieldName
): PropertyMetadataOverride | null {
  const active = overrides.filter((o) => o.fieldName === fieldName && o.clearedAt == null);
  if (active.length === 0) return null;
  return active.reduce((best, candidate) => {
    const bestTs = new Date(best.timestamp).getTime();
    const candTs = new Date(candidate.timestamp).getTime();
    if (candTs > bestTs) return candidate;
    if (candTs < bestTs) return best;
    return candidate.sourceNodeId.localeCompare(best.sourceNodeId) > 0 ? candidate : best;
  });
}

export function buildFieldProvenance(
  resolved: ResolvedPropertyMetadata,
  localNodeId: string
): MetadataFieldProvenance[] {
  return PROPERTY_METADATA_FIELDS.map((fieldName) => {
    const winner = pickActiveFieldOverride(resolved.overrides, fieldName);
    const baseValue = baseFieldString(fieldName, resolved.base);
    const effectiveValue = effectiveFieldString(fieldName, resolved.effective);
    if (!winner) {
      return { fieldName, source: "base", baseValue, effectiveValue };
    }
    return {
      fieldName,
      source: winner.sourceNodeId === localNodeId ? "local" : "peer",
      sourceNodeId: winner.sourceNodeId,
      timestamp: winner.timestamp,
      baseValue,
      effectiveValue,
    };
  });
}

export async function filterMetadataOverridesByBbox(
  overrides: PropertyMetadataOverride[],
  bboxFilter: (lat: number | null, lon: number | null) => boolean
): Promise<PropertyMetadataOverride[]> {
  if (overrides.length === 0) return [];

  const canonicalIds = [...new Set(overrides.map((o) => o.canonicalId))];
  const properties = await prisma.property.findMany({
    where: { canonicalId: { in: canonicalIds } },
    select: { id: true, canonicalId: true, name: true, location: true, lat: true, lon: true },
  });
  const resolved = await resolveEffectiveProperties(properties);
  const inBbox = new Set(
    resolved
      .filter(
        (p) =>
          p.effective.lat != null &&
          p.effective.lon != null &&
          bboxFilter(p.effective.lat, p.effective.lon)
      )
      .map((p) => p.canonicalId)
  );
  return overrides.filter((o) => inBbox.has(o.canonicalId));
}
