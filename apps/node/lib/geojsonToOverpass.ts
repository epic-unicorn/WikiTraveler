import type { OverpassElement } from "@/lib/overpass";

interface GeoJsonFeature {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: number[];
  };
  properties?: Record<string, unknown>;
}

/** Convert osmium geojson(seq) features to Overpass-shaped elements. */
export function geoJsonFeatureToElement(feature: GeoJsonFeature): OverpassElement | null {
  if (feature.type !== "Feature" || !feature.properties) return null;
  const geom = feature.geometry;
  if (geom?.type !== "Point" || !geom.coordinates || geom.coordinates.length < 2) return null;

  const [lon, lat] = geom.coordinates;
  const props = feature.properties;

  let osmType: "node" | "way" = "node";
  let id: number | null = null;

  const rawId = props["@id"] ?? props.id ?? props.osm_id;
  if (typeof rawId === "string" && rawId.includes("/")) {
    const [t, num] = rawId.split("/");
    osmType = t === "way" ? "way" : "node";
    id = parseInt(num ?? "", 10);
  } else if (typeof rawId === "number") {
    id = rawId;
    const t = props.type ?? props.osm_type;
    if (t === "way") osmType = "way";
  } else if (typeof rawId === "string") {
    id = parseInt(rawId, 10);
  }

  if (id == null || Number.isNaN(id)) return null;

  const tags: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("@")) continue;
    if (value == null) continue;
    if (typeof value === "object") continue;
    tags[key] = String(value);
  }

  if (osmType === "way") {
    return { type: "way", id, center: { lat, lon }, tags };
  }
  return { type: "node", id, lat, lon, tags };
}

export function parseGeoJsonSeqLine(line: string): OverpassElement | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const feature = JSON.parse(trimmed) as GeoJsonFeature;
    return geoJsonFeatureToElement(feature);
  } catch {
    return null;
  }
}

/** Parse a GeoJSON FeatureCollection or newline-delimited geojsonseq file content. */
export function parseGeoJsonExport(content: string): OverpassElement[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { type?: string; features?: GeoJsonFeature[] };
      if (parsed.type === "FeatureCollection" && Array.isArray(parsed.features)) {
        return parsed.features
          .map((f) => geoJsonFeatureToElement(f))
          .filter((e): e is OverpassElement => e != null);
      }
      const single = geoJsonFeatureToElement(parsed as GeoJsonFeature);
      return single ? [single] : [];
    } catch {
      // fall through to line-by-line
    }
  }

  const elements: OverpassElement[] = [];
  for (const line of trimmed.split("\n")) {
    const el = parseGeoJsonSeqLine(line);
    if (el) elements.push(el);
  }
  return elements;
}
