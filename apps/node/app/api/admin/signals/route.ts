import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { listSignalsForAdmin, countActionableSignalsForAdmin } from "@/lib/communitySignals";
import type { SignalStatus } from "@prisma/client";


export const dynamic = "force-dynamic";
const VALID_STATUS = new Set<SignalStatus>([
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "DISMISSED",
]);

// GET /api/admin/signals
export async function GET(req: NextRequest) {
  const authError = await requireRole(req, "AUDITOR");
  if (authError) return authError;

  const statusParam = req.nextUrl.searchParams.get("status")?.toUpperCase();
  if (req.nextUrl.searchParams.get("countOnly") === "1") {
    const openCount = await countActionableSignalsForAdmin();
    return NextResponse.json({ openCount });
  }

  const status =
    statusParam && VALID_STATUS.has(statusParam as SignalStatus)
      ? (statusParam as SignalStatus)
      : undefined;

  const signals = await listSignalsForAdmin(status);
  return NextResponse.json({ signals });
}
