import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getNodeSettings } from "@/lib/nodeSettings";
import { listRegionPresets } from "@/lib/regionPresets";
import type { NextRequest } from "next/server";

/** GET /api/admin/region — current region settings + presets catalog */
export async function GET(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const settings = await getNodeSettings();

  return NextResponse.json({
    settings,
    presets: listRegionPresets(),
  });
}
