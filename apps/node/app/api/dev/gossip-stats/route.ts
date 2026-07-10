import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NODE_ID } from "@/lib/nodeInfo";


export { dynamic } from "@/lib/apiRoute";
/**
 * GET /api/dev/gossip-stats
 * Public property/fact/peer counts for gossip-lab smoke checks (no auth).
 */
export async function GET() {
  if (process.env.GOSSIP_DEV !== "true" && process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const [propertyCount, factCount, overrideCount, peerRows] = await Promise.all([
    prisma.property.count(),
    prisma.accessibilityFact.count(),
    prisma.propertyMetadataOverride.count(),
    prisma.nodePeer.findMany({
      select: {
        url: true,
        nodeId: true,
        isActive: true,
        lastSeen: true,
        lastKnownVersion: true,
        gossipProtocol: true,
      },
      orderBy: { lastSeen: "desc" },
    }),
  ]);

  const peers = peerRows
    .filter((p) => p.nodeId !== NODE_ID)
    .map((p) => ({
      url: p.url,
      nodeId: p.nodeId,
      isActive: p.isActive,
      lastSeen: p.lastSeen.toISOString(),
      lastKnownVersion: p.lastKnownVersion,
      gossipProtocol: p.gossipProtocol,
    }));

  return NextResponse.json({
    propertyCount,
    factCount,
    overrideCount,
    peerCount: peers.filter((p) => p.isActive).length,
    peers,
  });
}
