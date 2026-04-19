import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/nodes — lists locally known active peers (used by inbox push)
export async function GET() {
  const peers = await prisma.nodePeer.findMany({
    where: { isActive: true },
    orderBy: { lastSeen: "desc" },
  });
  return NextResponse.json({ peers });
}
