import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/peers
 *
 * Returns the list of active peers this node knows about.
 * Used by clients and other nodes for peer discovery.
 */
export async function GET() {
  const peers = await prisma.nodePeer.findMany({
    where: { isActive: true },
    select: { url: true, nodeId: true, region: true, bbox: true },
    orderBy: { lastSeen: "desc" },
  });

  return NextResponse.json({
    peers: peers.map((p) => ({
      nodeId: p.nodeId ?? null,
      url: p.url,
      region: p.region ?? null,
      bbox: p.bbox ?? null,
    })),
  });
}
