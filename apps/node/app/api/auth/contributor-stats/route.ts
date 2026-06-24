import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { NODE_URL } from "@/lib/nodeInfo";
import { getContributorStats, reporterId } from "@/lib/communitySignals";
import { prisma } from "@/lib/prisma";

// GET /api/auth/contributor-stats
export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rid = reporterId(authUser.username, authUser.homeNodeUrl ?? NODE_URL);

  const [signalStats, auditCount] = await Promise.all([
    getContributorStats(rid),
    prisma.auditSubmission.count({
      where: {
        auditorToken: rid,
      },
    }),
  ]);

  return NextResponse.json({
    role: authUser.role,
    signals: signalStats,
    auditsSubmitted: auditCount,
  });
}
