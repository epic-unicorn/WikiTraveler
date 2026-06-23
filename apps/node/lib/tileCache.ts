import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { fetchOverpassData, type OverpassResult } from "@/lib/overpass";

function cacheRoot(): string {
  return process.env.OSM_TILE_CACHE_DIR ?? join(process.cwd(), ".cache", "osm-tiles");
}

export function tileCachePath(jobId: string, tileIndex: number): string {
  const dir = join(cacheRoot(), jobId);
  mkdirSync(dir, { recursive: true });
  return join(dir, `${tileIndex}.json`);
}

export function loadCachedTile(cachePath: string): OverpassResult | null {
  if (!existsSync(cachePath)) return null;
  try {
    return JSON.parse(readFileSync(cachePath, "utf-8")) as OverpassResult;
  } catch {
    return null;
  }
}

export function saveCachedTile(cachePath: string, result: OverpassResult): void {
  mkdirSync(join(cachePath, ".."), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(result));
}

export async function fetchTileOverpassData(
  jobId: string,
  tileIndex: number,
  bbox: string
): Promise<OverpassResult> {
  const cachePath = tileCachePath(jobId, tileIndex);
  const cached = loadCachedTile(cachePath);
  if (cached) {
    console.log(`[ingest-tile] Using cache ${cachePath}`);
    return cached;
  }

  const result = await fetchOverpassData(bbox);
  saveCachedTile(cachePath, result);
  return result;
}

export function clearJobTileCache(jobId: string): void {
  const dir = join(cacheRoot(), jobId);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}
