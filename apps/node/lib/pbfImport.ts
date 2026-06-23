import { createWriteStream, existsSync, mkdirSync, readFileSync } from "fs";
import { createReadStream } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import { createInterface } from "readline";
import { spawn } from "child_process";
import type { Bbox } from "@/lib/bbox";
import { containsPoint, formatBbox } from "@/lib/bbox";
import {
  buildOsmiumAccommodationFilterArgs,
  getGeofabrikRegion,
} from "@/lib/geofabrik";
import { geoJsonFeatureToElement, parseGeoJsonExport } from "@/lib/geojsonToOverpass";
import type { IngestStats, OverpassElement, OverpassResult } from "@/lib/overpass";
import { ingestOverpassResult } from "@/lib/overpass";
import type { PrismaClient } from "@prisma/client";

const BATCH_SIZE = 250;

export interface PbfImportProgress {
  (message: string, progress?: number): void;
}

function cacheDir(): string {
  const dir = process.env.GEOFABRIK_CACHE_DIR ?? join(process.cwd(), ".cache", "geofabrik");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export async function isOsmiumAvailable(): Promise<boolean> {
  try {
    await runCommand("osmium", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

function runCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}

async function downloadFile(url: string, dest: string, onProgress?: PbfImportProgress): Promise<void> {
  if (existsSync(dest)) {
    onProgress?.(`Using cached ${dest}`);
    return;
  }

  onProgress?.(`Downloading ${url}…`, 5);
  const res = await fetch(url, {
    headers: { "User-Agent": "WikiTraveler/0.2 (geofabrik-import)" },
    signal: AbortSignal.timeout(3_600_000),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }

  await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(dest));
  onProgress?.(`Downloaded to ${dest}`, 20);
}

async function filterAccommodationPbf(sourcePbf: string, filteredPbf: string): Promise<void> {
  if (existsSync(filteredPbf)) return;
  const filterArgs = buildOsmiumAccommodationFilterArgs();
  await runCommand("osmium", ["tags-filter", sourcePbf, ...filterArgs, "-o", filteredPbf, "-f", "pbf", "--overwrite"]);
}

async function exportGeoJsonSeq(filteredPbf: string, geojsonPath: string): Promise<void> {
  if (existsSync(geojsonPath)) return;
  await runCommand("osmium", [
    "export",
    filteredPbf,
    "-o",
    geojsonPath,
    "-f",
    "geojsonseq",
    "--overwrite",
  ]);
}

async function ingestElementBatch(
  elements: OverpassElement[],
  sourceNodeId: string,
  prisma: PrismaClient,
  agg: IngestStats
): Promise<void> {
  if (elements.length === 0) return;
  const stats = await ingestOverpassResult({ elements }, sourceNodeId, prisma);
  agg.total += stats.total;
  agg.created += stats.created;
  agg.updated += stats.updated;
  agg.deduped += stats.deduped;
  agg.skipped += stats.skipped;
}

/** Stream-ingest a geojsonseq export, clipping to bbox. */
export async function ingestGeoJsonSeqFile(
  geojsonPath: string,
  bbox: Bbox,
  sourceNodeId: string,
  prisma: PrismaClient,
  onProgress?: PbfImportProgress
): Promise<IngestStats> {
  const agg: IngestStats = { total: 0, created: 0, updated: 0, deduped: 0, skipped: 0 };
  let batch: OverpassElement[] = [];
  let lines = 0;

  const rl = createInterface({ input: createReadStream(geojsonPath), crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    lines += 1;

    let feature: unknown;
    try {
      feature = JSON.parse(trimmed);
    } catch {
      continue;
    }

    const el = geoJsonFeatureToElement(feature as Parameters<typeof geoJsonFeatureToElement>[0]);
    if (!el) continue;

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    if (!containsPoint(bbox, lat, lon)) continue;

    batch.push(el);
    if (batch.length >= BATCH_SIZE) {
      await ingestElementBatch(batch, sourceNodeId, prisma, agg);
      batch = [];
      if (lines % 2000 === 0) {
        onProgress?.(`Ingested ~${agg.total} elements…`, 40 + Math.min(50, Math.floor(lines / 500)));
      }
    }
  }

  await ingestElementBatch(batch, sourceNodeId, prisma, agg);
  return agg;
}

export interface ImportGeofabrikOptions {
  geofabrikId: string;
  bbox: Bbox;
  sourceNodeId: string;
  prisma: PrismaClient;
  onProgress?: PbfImportProgress;
  /** Skip download/filter when geojsonseq already exists (dev). */
  geojsonPath?: string;
}

export async function importGeofabrikRegion(options: ImportGeofabrikOptions): Promise<{
  elements: number;
  stats: IngestStats;
}> {
  const { geofabrikId, bbox, sourceNodeId, prisma, onProgress } = options;
  const region = getGeofabrikRegion(geofabrikId);
  if (!region) throw new Error(`Unknown Geofabrik region: ${geofabrikId}`);

  if (!options.geojsonPath && !(await isOsmiumAvailable())) {
    throw new Error(
      "osmium-tool is not installed. Install it (apt install osmium-tool) or use Docker dev image. " +
        "See: https://osmcode.org/osmium-tool/"
    );
  }

  const dir = cacheDir();
  const baseName = `${geofabrikId}-latest`;
  const sourcePbf = join(dir, `${baseName}.osm.pbf`);
  const filteredPbf = join(dir, `${baseName}-accommodation.osm.pbf`);
  const geojsonPath = options.geojsonPath ?? join(dir, `${baseName}-accommodation.geojsonseq`);

  onProgress?.(`Preparing Geofabrik import for ${region.label}…`, 2);

  if (!options.geojsonPath) {
    await downloadFile(region.url, sourcePbf, onProgress);
    onProgress?.("Filtering accommodation from extract…", 25);
    await filterAccommodationPbf(sourcePbf, filteredPbf);
    onProgress?.("Exporting to GeoJSON…", 35);
    await exportGeoJsonSeq(filteredPbf, geojsonPath);
  }

  onProgress?.(`Ingesting accommodations in ${formatBbox(bbox)}…`, 40);
  const stats = await ingestGeoJsonSeqFile(geojsonPath, bbox, sourceNodeId, prisma, onProgress);

  return { elements: stats.total, stats };
}

/** Import from a pre-exported GeoJSON / geojsonseq file (no osmium required). */
export async function importGeoJsonFile(
  filePath: string,
  bbox: Bbox,
  sourceNodeId: string,
  prisma: PrismaClient
): Promise<{ elements: number; stats: IngestStats }> {
  const content = readFileSync(filePath, "utf-8");
  const all = parseGeoJsonExport(content);
  const clipped = all.filter((el) => {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    return lat != null && lon != null && containsPoint(bbox, lat, lon);
  });

  const agg: IngestStats = { total: 0, created: 0, updated: 0, deduped: 0, skipped: 0 };
  for (let i = 0; i < clipped.length; i += BATCH_SIZE) {
    const batch = clipped.slice(i, i + BATCH_SIZE);
    const result: OverpassResult = { elements: batch };
    const stats = await ingestOverpassResult(result, sourceNodeId, prisma);
    agg.total += stats.total;
    agg.created += stats.created;
    agg.updated += stats.updated;
    agg.deduped += stats.deduped;
    agg.skipped += stats.skipped;
  }

  return { elements: agg.total, stats: agg };
}
