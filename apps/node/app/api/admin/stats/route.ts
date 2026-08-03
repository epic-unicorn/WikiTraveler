import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { loadStatsData } from "@/lib/statsData";
import type { NextRequest } from "next/server";


export const dynamic = "force-dynamic";
/** GET /api/admin/stats — dashboard statistics (ADMIN only) */
export async function GET(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const data = await loadStatsData();
  return NextResponse.json(data);
}
