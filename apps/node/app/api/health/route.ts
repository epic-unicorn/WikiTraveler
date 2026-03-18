import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NODE_ID, NODE_VERSION, NODE_URL } from "@/lib/nodeInfo";

export async function GET() {
  const [factCount, peerCount] = await Promise.all([
    prisma.accessibilityFact.count(),
    prisma.nodePeer.count({ where: { isActive: true } }),
  ]);

  return NextResponse.json({
    ok: true,
    nodeId: NODE_ID,
    version: NODE_VERSION,
    url: NODE_URL,
    factCount,
    peerCount,
    startedAt: new Date().toISOString(),
  });
}
