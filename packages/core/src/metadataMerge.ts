import type { PropertyMetadataFieldName, PropertyMetadataOverride } from "./types";

export function metadataOverrideKey(
  o: Pick<PropertyMetadataOverride, "canonicalId" | "fieldName" | "sourceNodeId">
): string {
  return `${o.canonicalId}::${o.fieldName}::${o.sourceNodeId}`;
}

/** Merge incoming metadata overrides; newer timestamp wins per source+field. */
export function mergeMetadataOverrides(
  existing: PropertyMetadataOverride[],
  incoming: PropertyMetadataOverride[]
): PropertyMetadataOverride[] {
  const map = new Map<string, PropertyMetadataOverride>();
  for (const o of existing) {
    map.set(metadataOverrideKey(o), o);
  }
  for (const o of incoming) {
    const key = metadataOverrideKey(o);
    const prev = map.get(key);
    if (!prev || new Date(o.timestamp) >= new Date(prev.timestamp)) {
      map.set(key, o);
    }
  }
  return [...map.values()];
}

export interface BasePropertyMetadata {
  name: string;
  location: string;
  lat: number | null;
  lon: number | null;
}

export interface EffectivePropertyMetadata extends BasePropertyMetadata {}

function isActiveOverride(o: PropertyMetadataOverride): boolean {
  return o.clearedAt == null;
}

function pickNewestOverride(
  overrides: PropertyMetadataOverride[]
): PropertyMetadataOverride | null {
  if (overrides.length === 0) return null;
  return overrides.reduce((best, candidate) => {
    const bestTs = new Date(best.timestamp).getTime();
    const candTs = new Date(candidate.timestamp).getTime();
    if (candTs > bestTs) return candidate;
    if (candTs < bestTs) return best;
    return candidate.sourceNodeId.localeCompare(best.sourceNodeId) > 0 ? candidate : best;
  });
}

function pickFieldOverride(
  overrides: PropertyMetadataOverride[],
  fieldName: PropertyMetadataFieldName
): PropertyMetadataOverride | null {
  const active = overrides.filter((o) => o.fieldName === fieldName && isActiveOverride(o));
  return pickNewestOverride(active);
}

function parseCoord(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Resolve effective metadata from base row + override records. */
export function resolveEffectiveMetadata(
  base: BasePropertyMetadata,
  overrides: PropertyMetadataOverride[]
): EffectivePropertyMetadata {
  const nameOverride = pickFieldOverride(overrides, "name");
  const locationOverride = pickFieldOverride(overrides, "location");

  // Coordinates: prefer newest source that has both active lat and lon overrides
  const bySource = new Map<string, PropertyMetadataOverride[]>();
  for (const o of overrides) {
    if (!isActiveOverride(o) || (o.fieldName !== "lat" && o.fieldName !== "lon")) continue;
    const list = bySource.get(o.sourceNodeId) ?? [];
    list.push(o);
    bySource.set(o.sourceNodeId, list);
  }

  let coordSource: string | null = null;
  let coordTs = -1;
  for (const [sourceNodeId, sourceOverrides] of bySource) {
    const latO = sourceOverrides.find((o) => o.fieldName === "lat");
    const lonO = sourceOverrides.find((o) => o.fieldName === "lon");
    if (!latO || !lonO) continue;
    const lat = parseCoord(latO.value);
    const lon = parseCoord(lonO.value);
    if (lat == null || lon == null) continue;
    const ts = Math.max(new Date(latO.timestamp).getTime(), new Date(lonO.timestamp).getTime());
    if (ts > coordTs || (ts === coordTs && sourceNodeId.localeCompare(coordSource ?? "") > 0)) {
      coordTs = ts;
      coordSource = sourceNodeId;
    }
  }

  let lat = base.lat;
  let lon = base.lon;
  if (coordSource) {
    const sourceOverrides = bySource.get(coordSource)!;
    const latO = sourceOverrides.find((o) => o.fieldName === "lat")!;
    const lonO = sourceOverrides.find((o) => o.fieldName === "lon")!;
    lat = parseCoord(latO.value);
    lon = parseCoord(lonO.value);
  }

  return {
    name: nameOverride?.value ?? base.name,
    location: locationOverride?.value ?? base.location,
    lat,
    lon,
  };
}
