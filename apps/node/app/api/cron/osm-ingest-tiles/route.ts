import { NextResponse } from "next/server";
import { advanceActiveIngestJobs } from "@/lib/ingestJob";
import type { NextRequest } from "next/server";

/**
 * GET /api/cron/osm-ingest-tiles
 *
 * Processes the next batch of tiles for any active ingest job.
 * Run every few minutes on Vercel so large regions complete without a long-running process.
 *
 * Protected by CRON_SECRET when set.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  const jobId = await advanceActiveIngestJobs();
  if (!jobId) {
    return NextResponse.json({ message: "No active ingest job." });
  }

  return NextResponse.json({ ok: true, jobId });
}
