import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getIngestJob, retryFailedIngestJob } from "@/lib/ingestJob";
import type { NextRequest } from "next/server";

/** POST /api/admin/ingest/[jobId]/retry — retry failed tiles or restart a failed PBF job */
export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const job = await getIngestJob(params.jobId);
  if (!job) {
    return NextResponse.json({ message: "Job not found" }, { status: 404 });
  }
  if (job.status !== "FAILED") {
    return NextResponse.json({ message: "Only failed jobs can be retried." }, { status: 400 });
  }

  try {
    await retryFailedIngestJob(params.jobId);
    const updated = await getIngestJob(params.jobId);
    return NextResponse.json({
      ok: true,
      jobId: params.jobId,
      status: updated?.status ?? "RUNNING",
    });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
