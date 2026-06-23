import { bisectBbox, formatBbox, getTileWarnLimit, splitBboxIntoTiles, type Bbox } from "@/lib/bbox";
import { fetchOverpassCount } from "@/lib/overpass";

const DEFAULT_TILE_ELEMENT_MAX = 4000;
const MAX_REFINE_DEPTH = 5;

export function getTileElementMax(): number {
  const n = parseInt(process.env.OSM_TILE_ELEMENT_MAX ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TILE_ELEMENT_MAX;
}

/** Subdivide tiles whose Overpass element count exceeds the per-tile cap. */
export async function refineTilesByElementCount(tiles: Bbox[]): Promise<Bbox[]> {
  const maxEl = getTileElementMax();
  const refined: Bbox[] = [];
  for (const tile of tiles) {
    const parts = await refineOneTile(tile, maxEl, 0);
    refined.push(...parts);
  }
  return refined;
}

async function refineOneTile(tile: Bbox, maxEl: number, depth: number): Promise<Bbox[]> {
  if (depth >= MAX_REFINE_DEPTH) return [tile];

  let count: number;
  try {
    count = await fetchOverpassCount(formatBbox(tile));
  } catch {
    return [tile];
  }

  if (count <= maxEl) return [tile];

  const [left, right] = bisectBbox(tile);
  const leftParts = await refineOneTile(left, maxEl, depth + 1);
  const rightParts = await refineOneTile(right, maxEl, depth + 1);
  return [...leftParts, ...rightParts];
}

/** Area-based tiles, optionally refined by live Overpass counts. */
export async function buildIngestTiles(bbox: Bbox, refine = true): Promise<Bbox[]> {
  const base = splitBboxIntoTiles(bbox);
  // Refining 100+ tiles means 100+ sequential Overpass calls before the job even starts.
  if (!refine || process.env.OSM_TILE_REFINE === "0" || base.length > getTileWarnLimit()) return base;
  return refineTilesByElementCount(base);
}
