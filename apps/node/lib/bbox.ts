/** Bbox string: "minLat,minLon,maxLat,maxLon" */

export type Bbox = [minLat: number, minLon: number, maxLat: number, maxLon: number];

/** Max area per Overpass tile (~45×45 km with margin). */
export const TILE_MAX_AREA_KM2 = 2000;

/** @deprecated Use TILE_MAX_AREA_KM2 — kept for existing imports/tests. */
export const MAX_BBOX_AREA_KM2 = TILE_MAX_AREA_KM2;

const DEFAULT_TILE_WARN = 40;
const DEFAULT_TILE_MAX = 150;

/** Below this overlap ratio a bbox change is treated as a "move". */
export const MOVE_OVERLAP_THRESHOLD = 0.2;

export function getTileWarnLimit(): number {
  const n = parseInt(process.env.OSM_TILE_WARN ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TILE_WARN;
}

export function getTileMaxLimit(): number {
  const n = parseInt(process.env.OSM_TILE_MAX ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TILE_MAX;
}

export function parseBbox(raw: string | null | undefined): Bbox | null {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  const [minLat, minLon, maxLat, maxLon] = parts;
  if (minLat >= maxLat || minLon >= maxLon) return null;
  if (minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180) return null;
  return [minLat, minLon, maxLat, maxLon];
}

export function formatBbox(b: Bbox): string {
  return `${b[0]},${b[1]},${b[2]},${b[3]}`;
}

export function bboxAreaKm2(b: Bbox): number {
  const [minLat, minLon, maxLat, maxLon] = b;
  const latMid = (minLat + maxLat) / 2;
  const latKm = (maxLat - minLat) * 111.32;
  const lonKm = (maxLon - minLon) * 111.32 * Math.cos((latMid * Math.PI) / 180);
  return Math.abs(latKm * lonKm);
}

export function containsPoint(bbox: Bbox, lat: number | null | undefined, lon: number | null | undefined): boolean {
  if (lat == null || lon == null) return false;
  const [minLat, minLon, maxLat, maxLon] = bbox;
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}

export function bboxCenter(b: Bbox): { lat: number; lon: number } {
  return { lat: (b[0] + b[2]) / 2, lon: (b[1] + b[3]) / 2 };
}

/** Split along the longer axis until every tile fits within maxAreaKm2. */
export function bisectBbox(bbox: Bbox): [Bbox, Bbox] {
  const [minLat, minLon, maxLat, maxLon] = bbox;
  const latMid = (minLat + maxLat) / 2;
  const lonMid = (minLon + maxLon) / 2;
  const latKm = (maxLat - minLat) * 111.32;
  const lonKm = (maxLon - minLon) * 111.32 * Math.cos((latMid * Math.PI) / 180);

  if (latKm >= lonKm) {
    return [
      [minLat, minLon, latMid, maxLon],
      [latMid, minLon, maxLat, maxLon],
    ];
  }
  return [
    [minLat, minLon, maxLat, lonMid],
    [minLat, lonMid, maxLat, maxLon],
  ];
}

/** Split a region into Overpass-safe tiles. Single-tile regions return the original bbox. */
export function splitBboxIntoTiles(bbox: Bbox, maxAreaKm2 = TILE_MAX_AREA_KM2): Bbox[] {
  let tiles: Bbox[] = [bbox];
  let guard = 0;
  while (tiles.some((t) => bboxAreaKm2(t) > maxAreaKm2)) {
    const next: Bbox[] = [];
    for (const t of tiles) {
      if (bboxAreaKm2(t) <= maxAreaKm2) next.push(t);
      else next.push(...bisectBbox(t));
    }
    tiles = next;
    guard += 1;
    if (guard > 500) throw new Error("Tile split exceeded safety limit");
  }
  return tiles;
}

export interface TilePlan {
  tiles: Bbox[];
  tileCount: number;
  areaKm2: number;
  warnLarge: boolean;
  estimatedDurationSec: number;
}

export function planTileIngest(bbox: Bbox): TilePlan {
  const tiles = splitBboxIntoTiles(bbox);
  const tileCount = tiles.length;
  const areaKm2 = bboxAreaKm2(bbox);
  const warnLarge = tileCount > getTileWarnLimit();
  // ~45 s Overpass + 3 s polite delay per tile
  const estimatedDurationSec = tileCount * 48;
  return { tiles, tileCount, areaKm2, warnLarge, estimatedDurationSec };
}

export function isChunkedIngestMode(): boolean {
  if (process.env.OSM_INGEST_MODE === "continuous") return false;
  if (process.env.OSM_INGEST_MODE === "chunked") return true;
  return Boolean(process.env.VERCEL);
}

export function getMaxTilesPerInvocation(): number {
  if (!isChunkedIngestMode()) return Number.POSITIVE_INFINITY;
  const n = parseInt(process.env.OSM_TILES_PER_CRON ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function getTileDelayMs(): number {
  const n = parseInt(process.env.OSM_TILE_DELAY_MS ?? "3000", 10);
  return Number.isFinite(n) && n >= 0 ? n : 3000;
}

/** True when proposed is fully inside current. */
export function isShrink(current: Bbox, proposed: Bbox): boolean {
  return (
    proposed[0] >= current[0] &&
    proposed[1] >= current[1] &&
    proposed[2] <= current[2] &&
    proposed[3] <= current[3] &&
    !(proposed[0] === current[0] && proposed[1] === current[1] && proposed[2] === current[2] && proposed[3] === current[3])
  );
}

/** True when proposed fully contains current and is larger. */
export function isExpand(current: Bbox, proposed: Bbox): boolean {
  return (
    proposed[0] <= current[0] &&
    proposed[1] <= current[1] &&
    proposed[2] >= current[2] &&
    proposed[3] >= current[3] &&
    !(proposed[0] === current[0] && proposed[1] === current[1] && proposed[2] === current[2] && proposed[3] === current[3])
  );
}

/** Intersection area / union area between two bboxes (0–1). */
export function bboxOverlapRatio(a: Bbox, b: Bbox): number {
  const minLat = Math.max(a[0], b[0]);
  const minLon = Math.max(a[1], b[1]);
  const maxLat = Math.min(a[2], b[2]);
  const maxLon = Math.min(a[3], b[3]);
  if (minLat >= maxLat || minLon >= maxLon) return 0;
  const intersection = bboxAreaKm2([minLat, minLon, maxLat, maxLon]);
  const union = bboxAreaKm2(a) + bboxAreaKm2(b) - intersection;
  return union > 0 ? intersection / union : 0;
}

export type RegionChangeType = "initial" | "shrink" | "expand" | "move" | "unchanged";

export function classifyBboxChange(current: Bbox | null, proposed: Bbox): RegionChangeType {
  if (!current) return "initial";
  if (
    current[0] === proposed[0] &&
    current[1] === proposed[1] &&
    current[2] === proposed[2] &&
    current[3] === proposed[3]
  ) {
    return "unchanged";
  }
  if (isShrink(current, proposed)) return "shrink";
  if (isExpand(current, proposed)) return "expand";
  const overlap = bboxOverlapRatio(current, proposed);
  return overlap < MOVE_OVERLAP_THRESHOLD ? "move" : "expand";
}

export type ValidateBboxResult =
  | { ok: true; bbox: Bbox; tileCount: number; warnLarge: boolean; areaKm2: number }
  | { ok: false; message: string };

export function validateBbox(raw: string): ValidateBboxResult {
  const bbox = parseBbox(raw);
  if (!bbox) return { ok: false, message: "Invalid bbox format. Use minLat,minLon,maxLat,maxLon." };

  const plan = planTileIngest(bbox);
  const tileMax = getTileMaxLimit();

  if (plan.tileCount > tileMax) {
    return {
      ok: false,
      message: `Region requires ${plan.tileCount} tiles (maximum ${tileMax}). Use a smaller area or Geofabrik import.`,
    };
  }

  return {
    ok: true,
    bbox,
    tileCount: plan.tileCount,
    warnLarge: plan.warnLarge,
    areaKm2: plan.areaKm2,
  };
}
