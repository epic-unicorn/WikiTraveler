import { NextResponse } from "next/server";
import { NODE_ID } from "@/lib/nodeInfo";
import { parseBbox, getMaxTilesPerInvocation } from "@/lib/bbox";
import { getLastIngestAt, getNodeBbox } from "@/lib/nodeSettings";
import {
  advanceActiveIngestJobs,
  createIngestJob,
  getActiveIngestJob,
  processIngestJob,
} from "@/lib/ingestJob";
import type { NextRequest } from "next/server";

/**
 * GET /api/cron/osm-ingest
 *
 * Weekly refresh of accommodation data for the admin-configured bbox.
 * Skips when: no bbox, never ingested, or last sync < 7 days ago.
 * Uses tiled ingest — processes one batch per invocation on Vercel.
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

  const active = await getActiveIngestJob();
  if (active) {
    await processIngestJob(active.id, { maxTiles: getMaxTilesPerInvocation() });
    return NextResponse.json({
      ok: true,
      message: "Advanced active ingest job",
      jobId: active.id,
    });
  }

  const bbox = await getNodeBbox();
  if (!bbox) {
    return NextResponse.json({ message: "Skipped — no region configured in admin." });
  }

  const lastIngest = await getLastIngestAt();
  if (!lastIngest) {
    return NextResponse.json({
      message: "Skipped — region configured but never ingested. Run ingest from admin first.",
      bbox,
    });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";

  if (!force) {
    const ageMs = Date.now() - lastIngest.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < 7) {
      return NextResponse.json({
        message: `Skipped — last sync was ${ageDays.toFixed(1)} days ago (< 7-day threshold). Add ?force=1 to override.`,
        lastSync: lastIngest,
        bbox,
      });
    }
  }

  const parsed = parseBbox(bbox);
  if (!parsed) {
    return NextResponse.json({ message: "Invalid bbox in settings." }, { status: 500 });
  }

  const started = Date.now();
  const jobId = await createIngestJob(parsed, "refresh");
  await processIngestJob(jobId, { maxTiles: getMaxTilesPerInvocation() });

  return NextResponse.json({
    ok: true,
    bbox,
    jobId,
    nodeId: NODE_ID,
    durationMs: Date.now() - started,
    message: "Refresh ingest job started (tiled).",
  });
}
