import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { NODE_VERSION } from "@/lib/nodeInfo";
import { assessUpgrade, fetchReleaseManifest } from "@/lib/releaseManifest";


export const dynamic = "force-dynamic";
/** GET /api/admin/upgrade-status — optional release manifest + upgrade advisory (ADMIN only) */
export async function GET(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const manifest = await fetchReleaseManifest();
  const upgrade = assessUpgrade({ currentVersion: NODE_VERSION, manifest });

  return NextResponse.json({
    currentVersion: NODE_VERSION,
    manifest,
    upgrade,
  });
}
