import { prisma } from "@/lib/prisma";
import { NODE_ID } from "@/lib/nodeInfo";
import {
  classifyBboxChange,
  formatBbox,
  getMaxTilesPerInvocation,
  getTileDelayMs,
  getTileMaxLimit,
  isChunkedIngestMode,
  parseBbox,
  planTileIngest,
  type Bbox,
  type RegionChangeType,
} from "@/lib/bbox";
import { estimateGeofabrikIngest } from "@/lib/geofabrik";
import { deriveRegionLabel } from "@/lib/geocode";
import { importGeofabrikRegion, importGeoJsonFile } from "@/lib/pbfImport";
import { commitNodeBbox, getNodeBboxParsed, recordIngestComplete } from "@/lib/nodeSettings";
import { getPresetById, isGeofabrikPreset } from "@/lib/regionPresets";
import { countPropertiesOutsideBbox, purgeGossipOutsideBbox, purgeOutsideBbox } from "@/lib/regionPurge";
import { ingestOverpassResult } from "@/lib/overpass";
import { buildIngestTiles } from "@/lib/tileRefine";
import { clearJobTileCache, fetchTileOverpassData } from "@/lib/tileCache";
import type { Prisma } from "@prisma/client";

export type IngestChangeType = RegionChangeType | "refresh" | "pbf-import" | "geojson-import";

const DEFAULT_STALE_HOURS = 48;

export function getStaleIngestHours(): number {
  const n = parseInt(process.env.OSM_INGEST_STALE_HOURS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_STALE_HOURS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateJob(
  id: string,
  data: {
    status?: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
    phase?: "PURGING" | "FETCHING" | "INGESTING" | "DONE" | null;
    progress?: number;
    tilesDone?: number;
    message?: string | null;
    stats?: Prisma.InputJsonValue;
    error?: string | null;
    startedAt?: Date;
    finishedAt?: Date | null;
  }
) {
  await prisma.ingestJob.update({ where: { id }, data });
}

export async function createIngestJob(
  bbox: Bbox,
  changeType: IngestChangeType,
  options: { geofabrikId?: string; geojsonPath?: string } = {}
): Promise<string> {
  if (changeType === "pbf-import") {
    if (!options.geofabrikId) throw new Error("geofabrikId required for pbf-import jobs");
    const job = await prisma.ingestJob.create({
      data: {
        bbox: formatBbox(bbox),
        changeType,
        status: "PENDING",
        tileCount: 0,
        stats: { geofabrikId: options.geofabrikId, purged: false },
      },
    });
    return job.id;
  }

  if (changeType === "geojson-import") {
    if (!options.geojsonPath) throw new Error("geojsonPath required for geojson-import jobs");
    const job = await prisma.ingestJob.create({
      data: {
        bbox: formatBbox(bbox),
        changeType,
        status: "PENDING",
        tileCount: 0,
        stats: { geojsonPath: options.geojsonPath, purged: false },
      },
    });
    return job.id;
  }

  const needsTiles = changeType !== "shrink";
  const tiles = needsTiles ? await buildIngestTiles(bbox) : [];
  if (needsTiles && tiles.length > getTileMaxLimit()) {
    throw new Error(
      `Region requires ${tiles.length} tiles after refinement (maximum ${getTileMaxLimit()}). Use Geofabrik import or a smaller area.`
    );
  }

  const job = await prisma.ingestJob.create({
    data: {
      bbox: formatBbox(bbox),
      changeType,
      status: "PENDING",
      tileCount: needsTiles ? tiles.length : 0,
      tiles: needsTiles
        ? {
            create: tiles.map((t, index) => ({
              index,
              bbox: formatBbox(t),
            })),
          }
        : undefined,
    },
  });
  return job.id;
}

/** Fire-and-forget ingest — processes all tiles on long-running servers, first batch on Vercel. */
export function startIngestJob(jobId: string): void {
  void processIngestJob(jobId).catch((err) => {
    console.error(`[ingest-job] ${jobId} failed:`, err);
  });
}

async function runPurgeIfNeeded(
  jobId: string,
  bbox: Bbox,
  changeType: IngestChangeType,
  existingStats: Record<string, unknown> | null
): Promise<Record<string, unknown>> {
  const purged = existingStats?.purged === true;
  if (changeType === "refresh" || purged) return existingStats ?? {};

  await updateJob(jobId, {
    phase: "PURGING",
    progress: 2,
    message: "Removing data outside the new region…",
  });
  const removed = await purgeOutsideBbox(prisma, bbox);
  await purgeGossipOutsideBbox(prisma, bbox);
  return { ...existingStats, purged: true, removed };
}

/** Process up to maxTiles pending tiles for a job. Safe to call repeatedly (chunked mode). */
export async function processIngestJob(
  jobId: string,
  options: { maxTiles?: number; allowFailed?: boolean } = {}
): Promise<void> {
  const maxTiles = options.maxTiles ?? getMaxTilesPerInvocation();

  const job = await prisma.ingestJob.findUnique({
    where: { id: jobId },
    include: { tiles: { orderBy: { index: "asc" } } },
  });
  if (!job || job.status === "COMPLETED") return;
  if (job.status === "FAILED" && !options.allowFailed) return;

  const bbox = parseBbox(job.bbox);
  if (!bbox) {
    await updateJob(jobId, {
      status: "FAILED",
      error: "Invalid bbox on job",
      finishedAt: new Date(),
    });
    return;
  }

  const changeType = (job.changeType ?? "initial") as IngestChangeType;
  let jobStats = (job.stats as Record<string, unknown> | null) ?? {};

  try {
    if (job.status === "PENDING" || job.status === "FAILED") {
      await updateJob(jobId, { status: "RUNNING", startedAt: job.startedAt ?? new Date(), error: null });
    }

    if (changeType === "shrink") {
      await updateJob(jobId, {
        phase: "PURGING",
        progress: 5,
        message: "Removing data outside the new region…",
      });
      const removed = await purgeOutsideBbox(prisma, bbox);
      await purgeGossipOutsideBbox(prisma, bbox);
      const region = await deriveRegionLabel(bbox);
      await commitNodeBbox(bbox, region);
      await updateJob(jobId, {
        status: "COMPLETED",
        phase: "DONE",
        progress: 100,
        message: `Region updated. Removed ${removed} properties outside the new area.`,
        stats: { removed, created: 0, updated: 0 },
        finishedAt: new Date(),
      });
      return;
    }

    if (changeType === "pbf-import") {
      const geofabrikId = jobStats.geofabrikId as string | undefined;
      if (!geofabrikId) {
        throw new Error("Missing geofabrikId on pbf-import job");
      }
      if (isChunkedIngestMode()) {
        throw new Error(
          "Geofabrik import requires a long-running server (Docker/VPS) with osmium-tool — not Vercel serverless."
        );
      }

      jobStats = await runPurgeIfNeeded(jobId, bbox, changeType, jobStats);
      await updateJob(jobId, { stats: jobStats });

      const { elements, stats } = await importGeofabrikRegion({
        geofabrikId,
        bbox,
        sourceNodeId: `${NODE_ID}:osm`,
        prisma,
        onProgress: (message, progress) => {
          void updateJob(jobId, {
            phase: progress != null && progress < 40 ? "FETCHING" : "INGESTING",
            message,
            progress: progress ?? undefined,
          });
        },
      });

      const region = await deriveRegionLabel(bbox);
      await commitNodeBbox(bbox, region);
      await recordIngestComplete(elements);

      await updateJob(jobId, {
        status: "COMPLETED",
        phase: "DONE",
        progress: 100,
        message: `Geofabrik import complete (${elements} elements).`,
        stats: { ...jobStats, ...stats, elements, geofabrikId },
        finishedAt: new Date(),
      });
      return;
    }

    if (changeType === "geojson-import") {
      const geojsonPath = jobStats.geojsonPath as string | undefined;
      if (!geojsonPath) {
        throw new Error("Missing geojsonPath on geojson-import job");
      }

      jobStats = await runPurgeIfNeeded(jobId, bbox, changeType, jobStats);
      await updateJob(jobId, { stats: jobStats, phase: "INGESTING", message: "Importing GeoJSON file…", progress: 10 });

      const { elements, stats } = await importGeoJsonFile(geojsonPath, bbox, `${NODE_ID}:osm`, prisma);

      const region = await deriveRegionLabel(bbox);
      await commitNodeBbox(bbox, region);
      await recordIngestComplete(elements);

      await updateJob(jobId, {
        status: "COMPLETED",
        phase: "DONE",
        progress: 100,
        message: `GeoJSON import complete (${elements} elements).`,
        stats: { ...jobStats, ...stats, elements, geojsonPath },
        finishedAt: new Date(),
      });
      return;
    }

    jobStats = await runPurgeIfNeeded(jobId, bbox, changeType, jobStats);
    await updateJob(jobId, { stats: jobStats });

    const pendingTiles = job.tiles.filter((t) => t.status === "PENDING" || t.status === "FAILED");
    const batch =
      maxTiles === Number.POSITIVE_INFINITY ? pendingTiles : pendingTiles.slice(0, maxTiles);

    let tilesDone = job.tilesDone;
    let totalElements = (jobStats.elements as number | undefined) ?? 0;
    const aggStats = {
      created: (jobStats.created as number | undefined) ?? 0,
      updated: (jobStats.updated as number | undefined) ?? 0,
      skipped: (jobStats.skipped as number | undefined) ?? 0,
      removed: (jobStats.removed as number | undefined) ?? 0,
    };

    for (let i = 0; i < batch.length; i++) {
      const tile = batch[i]!;
      if (i > 0) await sleep(getTileDelayMs());

      await prisma.ingestJobTile.update({
        where: { id: tile.id },
        data: { status: "RUNNING", startedAt: new Date(), error: null },
      });

      const tileNum = tile.index + 1;
      const tileTotal = job.tileCount ?? job.tiles.length;
      await updateJob(jobId, {
        phase: "FETCHING",
        message: `Downloading tile ${tileNum}/${tileTotal}…`,
        progress: Math.round((tilesDone / tileTotal) * 90),
      });

      try {
        const result = await fetchTileOverpassData(jobId, tile.index, tile.bbox);

        await updateJob(jobId, {
          phase: "INGESTING",
          message: `Ingesting tile ${tileNum}/${tileTotal} (${result.elements.length} elements)…`,
        });

        const stats = await ingestOverpassResult(result, `${NODE_ID}:osm`, prisma);

        await prisma.ingestJobTile.update({
          where: { id: tile.id },
          data: {
            status: "COMPLETED",
            elementCount: result.elements.length,
            finishedAt: new Date(),
          },
        });

        tilesDone += 1;
        totalElements += result.elements.length;
        aggStats.created += stats.created;
        aggStats.updated += stats.updated;
        aggStats.skipped += stats.skipped;

        await updateJob(jobId, {
          tilesDone,
          progress: Math.round((tilesDone / tileTotal) * 90),
          stats: { ...jobStats, ...aggStats, elements: totalElements, purged: true },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await prisma.ingestJobTile.update({
          where: { id: tile.id },
          data: { status: "FAILED", error: msg, finishedAt: new Date() },
        });
        throw err;
      }
    }

    const remaining = await prisma.ingestJobTile.count({
      where: { jobId, status: { in: ["PENDING", "FAILED"] } },
    });

    if (remaining > 0) return;

    const region = await deriveRegionLabel(bbox);
    await commitNodeBbox(bbox, region);
    await recordIngestComplete(totalElements);

    await updateJob(jobId, {
      status: "COMPLETED",
      phase: "DONE",
      progress: 100,
      message: `Ingest complete (${tilesDone} tiles, ${totalElements} elements).`,
      stats: { ...jobStats, ...aggStats, elements: totalElements, purged: true },
      finishedAt: new Date(),
    });
    clearJobTileCache(jobId);
  } catch (err) {
    await updateJob(jobId, {
      status: "FAILED",
      error: err instanceof Error ? err.message : String(err),
      finishedAt: new Date(),
    });
  }
}

/** Reset failed tiles and resume a failed Overpass tile job. */
export async function retryFailedIngestJob(jobId: string): Promise<void> {
  const job = await prisma.ingestJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");
  if (job.changeType === "pbf-import" || job.changeType === "geojson-import") {
    await updateJob(jobId, { status: "PENDING", error: null, finishedAt: null });
    await processIngestJob(jobId, { allowFailed: true });
    return;
  }

  await prisma.ingestJobTile.updateMany({
    where: { jobId, status: "FAILED" },
    data: { status: "PENDING", error: null, finishedAt: null, startedAt: null },
  });

  await updateJob(jobId, {
    status: "RUNNING",
    error: null,
    finishedAt: null,
    message: "Retrying failed tiles…",
  });

  await processIngestJob(jobId, { allowFailed: true });
}

/** Advance any active job — used by cron and poll endpoints in chunked mode. */
export async function advanceActiveIngestJobs(): Promise<string | null> {
  await failStaleIngestJobs();
  const active = await getActiveIngestJob();
  if (!active) return null;
  await processIngestJob(active.id, { maxTiles: getMaxTilesPerInvocation() });
  return active.id;
}

/** Mark long-running PENDING/RUNNING jobs as FAILED so the UI can recover. */
export async function failStaleIngestJobs(): Promise<number> {
  const hours = getStaleIngestHours();
  const cutoff = new Date(Date.now() - hours * 3600_000);
  const stale = await prisma.ingestJob.findMany({
    where: {
      status: { in: ["PENDING", "RUNNING"] },
      OR: [
        { status: "PENDING", createdAt: { lt: cutoff } },
        { status: "RUNNING", startedAt: { lt: cutoff } },
      ],
    },
    select: { id: true },
  });

  if (stale.length === 0) return 0;

  await prisma.ingestJob.updateMany({
    where: { id: { in: stale.map((j) => j.id) } },
    data: {
      status: "FAILED",
      error: `Job timed out after ${hours}h without completing`,
      finishedAt: new Date(),
    },
  });

  for (const { id } of stale) clearJobTileCache(id);
  return stale.length;
}

export async function planRegionApply(
  proposedBbox: Bbox,
  presetId?: string | null
): Promise<{
  changeType: RegionChangeType;
  requiresExport: boolean;
  requiresIngest: boolean;
  propertiesToRemove: number;
  regionLabel: string;
  tileCount: number;
  warnLarge: boolean;
  areaKm2: number;
  estimatedDurationSec: number;
  ingestMode: "overpass" | "geofabrik";
  geofabrikId: string | null;
  geofabrikDownloadMb: number | null;
}> {
  const preset = presetId ? getPresetById(presetId) : undefined;
  const geofabrik = isGeofabrikPreset(preset);
  const current = await getNodeBboxParsed();
  const changeType = classifyBboxChange(current, proposedBbox);
  const tilePlan = planTileIngest(proposedBbox);
  const propertiesToRemove =
    changeType === "shrink" || changeType === "expand" || changeType === "move"
      ? await countPropertiesOutsideBbox(prisma, proposedBbox)
      : 0;
  const regionLabel = await deriveRegionLabel(proposedBbox, presetId);

  if (geofabrik && preset?.geofabrikId) {
    const est = estimateGeofabrikIngest(preset.geofabrikId);
    return {
      changeType,
      requiresExport: changeType === "move",
      requiresIngest: changeType !== "shrink" && changeType !== "unchanged",
      propertiesToRemove,
      regionLabel,
      tileCount: 0,
      warnLarge: true,
      areaKm2: tilePlan.areaKm2,
      estimatedDurationSec: est.durationSeconds,
      ingestMode: "geofabrik",
      geofabrikId: preset.geofabrikId,
      geofabrikDownloadMb: est.downloadSizeMb,
    };
  }

  return {
    changeType,
    requiresExport: changeType === "move",
    requiresIngest: changeType !== "shrink" && changeType !== "unchanged",
    propertiesToRemove,
    regionLabel,
    tileCount: tilePlan.tileCount,
    warnLarge: tilePlan.warnLarge,
    areaKm2: tilePlan.areaKm2,
    estimatedDurationSec: tilePlan.estimatedDurationSec,
    ingestMode: "overpass",
    geofabrikId: null,
    geofabrikDownloadMb: null,
  };
}

export async function getIngestJob(jobId: string) {
  return prisma.ingestJob.findUnique({
    where: { id: jobId },
    include: { tiles: { orderBy: { index: "asc" } } },
  });
}

export async function getActiveIngestJob() {
  return prisma.ingestJob.findFirst({
    where: { status: { in: ["PENDING", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
  });
}

export { isChunkedIngestMode };
