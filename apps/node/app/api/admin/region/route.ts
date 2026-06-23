import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { failStaleIngestJobs, getActiveIngestJob } from "@/lib/ingestJob";
import { getNodeSettings } from "@/lib/nodeSettings";
import { listRegionPresets } from "@/lib/regionPresets";
import type { NextRequest } from "next/server";

/** GET /api/admin/region — current region settings + presets catalog */
export async function GET(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const [settings, activeJob] = await Promise.all([
    getNodeSettings(),
    failStaleIngestJobs().then(() => getActiveIngestJob()),
  ]);

  return NextResponse.json({
    settings,
    presets: listRegionPresets(),
    activeIngestJob: activeJob
      ? {
          id: activeJob.id,
          status: activeJob.status,
          phase: activeJob.phase,
          progress: activeJob.progress,
          message: activeJob.message,
          error: activeJob.error,
          tileCount: activeJob.tileCount,
          tilesDone: activeJob.tilesDone,
          changeType: activeJob.changeType,
        }
      : null,
  });
}
