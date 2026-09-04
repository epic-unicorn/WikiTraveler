import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { clearClosedSignals, countClosedSignals } from "@/lib/communitySignals";

export const dynamic = "force-dynamic";

// GET /api/admin/signals/cleanup — count of RESOLVED + DISMISSED
export async function GET(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const count = await countClosedSignals();
  return NextResponse.json({ count });
}

// POST /api/admin/signals/cleanup — permanently delete RESOLVED + DISMISSED
export async function POST(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const deleted = await clearClosedSignals();
  return NextResponse.json({ ok: true, deleted });
}
