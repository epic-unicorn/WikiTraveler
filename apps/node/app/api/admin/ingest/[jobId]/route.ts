import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getIngestJob, isChunkedIngestMode, processIngestJob } from "@/lib/ingestJob";
import { getMaxTilesPerInvocation } from "@/lib/bbox";
import type { NextRequest } from "next/server";

/** GET /api/admin/ingest/[jobId] — poll ingest job status; advances chunked jobs while polling */
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  let job = await getIngestJob(params.jobId);
  if (!job) {
    return NextResponse.json({ message: "Job not found" }, { status: 404 });
  }

  if (
    isChunkedIngestMode() &&
    (job.status === "RUNNING" || job.status === "PENDING")
  ) {
    await processIngestJob(job.id, { maxTiles: getMaxTilesPerInvocation() });
    job = await getIngestJob(params.jobId);
    if (!job) {
      return NextResponse.json({ message: "Job not found" }, { status: 404 });
    }
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    phase: job.phase,
    progress: job.progress,
    message: job.message,
    stats: job.stats,
    error: job.error,
    changeType: job.changeType,
    tileCount: job.tileCount,
    tilesDone: job.tilesDone,
    tiles: job.tiles.map((t) => ({
      index: t.index,
      status: t.status,
      elementCount: t.elementCount,
      error: t.error,
    })),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
  });
}
