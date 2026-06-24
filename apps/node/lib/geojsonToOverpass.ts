import type { OverpassElement } from "@/lib/overpass";

interface GeoJsonFeature {
  type?: string;
  id?: string | number;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: Record<string, unknown>;
}

/** Strip GeoJSON Text Sequence record separator (0x1e) before JSON.parse. */
export function stripGeoJsonSeqLine(line: string): string {
  return line.trim().replace(/^\u001e/, "");
}

function coordsFromGeometry(geometry: GeoJsonFeature["geometry"]): { lat: number; lon: number } | null {
  if (!geometry?.coordinates) return null;

  if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
    const coords = geometry.coordinates as number[];
    if (coords.length < 2) return null;
    const [lon, lat] = coords;
    return { lat, lon };
  }

  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
    const ring = (geometry.coordinates as number[][][])[0];
    if (!ring?.length) return null;
    let latSum = 0;
    let lonSum = 0;
    for (const coord of ring) {
      if (!Array.isArray(coord) || coord.length < 2) continue;
      lonSum += coord[0]!;
      latSum += coord[1]!;
    }
    return { lat: latSum / ring.length, lon: lonSum / ring.length };
  }

  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    const firstPoly = (geometry.coordinates as number[][][][])[0];
    return coordsFromGeometry({ type: "Polygon", coordinates: firstPoly });
  }

  return null;
}

function parseOsmId(
  props: Record<string, unknown>,
  featureId: GeoJsonFeature["id"]
): { osmType: "node" | "way" | "relation"; id: number } | null {
  const rawId = props["@id"] ?? props.id ?? props.osm_id ?? featureId;
  if (typeof rawId === "string" && rawId.includes("/")) {
    const [t, num] = rawId.split("/");
    const id = parseInt(num ?? "", 10);
    if (Number.isNaN(id)) return null;
    const osmType = t === "way" ? "way" : t === "relation" ? "relation" : "node";
    return { osmType, id };
  }

  if (typeof rawId === "string") {
    const typeId = rawId.match(/^([nwr])(\d+)$/);
    if (typeId) {
      const osmType =
        typeId[1] === "w" ? "way" : typeId[1] === "r" ? "relation" : "node";
      return { osmType, id: parseInt(typeId[2]!, 10) };
    }
    const id = parseInt(rawId, 10);
    if (!Number.isNaN(id)) {
      const t = props.type ?? props.osm_type ?? props["@type"];
      const osmType = t === "way" ? "way" : t === "relation" ? "relation" : "node";
      return { osmType, id };
    }
  }

  if (typeof rawId === "number" && !Number.isNaN(rawId)) {
    const t = props.type ?? props.osm_type ?? props["@type"];
    const osmType = t === "way" ? "way" : t === "relation" ? "relation" : "node";
    return { osmType, id: rawId };
  }

  return null;
}

/** Convert osmium geojson(seq) features to Overpass-shaped elements. */
export function geoJsonFeatureToElement(feature: GeoJsonFeature): OverpassElement | null {
  if (feature.type !== "Feature" || !feature.properties) return null;

  const coords = coordsFromGeometry(feature.geometry);
  if (!coords) return null;

  const parsed = parseOsmId(feature.properties, feature.id);
  if (!parsed) return null;

  const tags: Record<string, string> = {};
  for (const [key, value] of Object.entries(feature.properties)) {
    if (key.startsWith("@")) continue;
    if (value == null) continue;
    if (typeof value === "object") continue;
    tags[key] = String(value);
  }

  if (parsed.osmType === "way" || parsed.osmType === "relation") {
    return { type: parsed.osmType, id: parsed.id, center: coords, tags };
  }
  return { type: "node", id: parsed.id, lat: coords.lat, lon: coords.lon, tags };
}

export function parseGeoJsonSeqLine(line: string): OverpassElement | null {
  const trimmed = stripGeoJsonSeqLine(line);
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
