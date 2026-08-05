import { bboxAreaKm2, parseBbox, type Bbox } from "./bbox";

/** Default max viewport area for Access map pin queries (~220×220 km). */
export const DEFAULT_MAP_VIEWPORT_MAX_AREA_KM2 = 50_000;

/** Default pin cap when a viewport bbox is provided (Access-oriented). */
export const DEFAULT_MAP_VIEWPORT_PIN_LIMIT = 1500;

export function getMapViewportMaxAreaKm2(): number {
  const n = parseInt(process.env.MAP_VIEWPORT_MAX_AREA_KM2 ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAP_VIEWPORT_MAX_AREA_KM2;
}

export function getMapViewportPinLimit(): number {
  const n = parseInt(process.env.MAP_VIEWPORT_PIN_LIMIT ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAP_VIEWPORT_PIN_LIMIT;
}

export type MapBboxErrorCode = "BBOX_REQUIRED" | "BBOX_INVALID" | "BBOX_TOO_LARGE";

export type MapBboxResult =
  | { ok: true; bbox: Bbox; bboxStr: string }
  | { ok: false; code: MapBboxErrorCode; message: string; areaKm2?: number; maxAreaKm2?: number };

/** Validate a client `bbox=minLat,minLon,maxLat,maxLon` for map pin queries. */
export function validateMapBbox(
  raw: string | null | undefined,
  options?: { maxAreaKm2?: number; skipAreaCheck?: boolean }
): MapBboxResult {
  if (!raw?.trim()) {
    return { ok: false, code: "BBOX_REQUIRED", message: "bbox query parameter is required (minLat,minLon,maxLat,maxLon)" };
  }
  const bbox = parseBbox(raw.trim());
  if (!bbox) {
    return { ok: false, code: "BBOX_INVALID", message: "bbox must be minLat,minLon,maxLat,maxLon" };
  }
  if (!options?.skipAreaCheck) {
    const maxAreaKm2 = options?.maxAreaKm2 ?? getMapViewportMaxAreaKm2();
    const areaKm2 = bboxAreaKm2(bbox);
    if (areaKm2 > maxAreaKm2) {
      return {
        ok: false,
        code: "BBOX_TOO_LARGE",
        message: "Map area is too large — zoom in to see places",
        areaKm2,
        maxAreaKm2,
      };
    }
  }
  return { ok: true, bbox, bboxStr: `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}` };
}

/** Prisma-friendly lat/lon filter for a bbox (inclusive). Null coords excluded by range. */
export function propertyWhereInBbox(bbox: Bbox) {
  const [minLat, minLon, maxLat, maxLon] = bbox;
  return {
    lat: { gte: minLat, lte: maxLat },
    lon: { gte: minLon, lte: maxLon },
  };
}

/** Rough degree delta for nearby prefilter (~111 km per degree latitude). */
export function nearbyPrefilterDegrees(lat: number, radiusKm: number): { dLat: number; dLon: number } {
  const dLat = radiusKm / 111.32;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLon = cos > 0.01 ? radiusKm / (111.32 * cos) : 180;
  return { dLat, dLon };
}
