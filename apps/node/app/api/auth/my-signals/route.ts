import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { NODE_URL } from "@/lib/nodeInfo";
import { reporterId } from "@/lib/communitySignals";
import { prisma } from "@/lib/prisma";


export const dynamic = "force-dynamic";
// GET /api/auth/my-signals
export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rid = reporterId(authUser.username, authUser.homeNodeUrl ?? NODE_URL);

  const signals = await prisma.communitySignal.findMany({
    where: { reporterId: rid },
    include: {
      property: { select: { id: true, name: true, location: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ signals });
}
