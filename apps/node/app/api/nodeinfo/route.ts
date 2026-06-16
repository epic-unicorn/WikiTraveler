import { NextResponse } from "next/server";
import { NODE_ID, NODE_URL, NODE_VERSION, NODE_REGION, NODE_BBOX } from "@/lib/nodeInfo";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/nodeinfo
 *
 * Returns this node's public identity, public key, and known peers.
 * Clients/peers cache the public key here for RS256 JWT verification.
 */
export async function GET() {
  const peerRows = await prisma.nodePeer.findMany({
    where: { isActive: true },
    select: { url: true, nodeId: true, region: true, bbox: true },
  });
  const peers = peerRows
    .filter((p) => p.nodeId !== NODE_ID)
    .map((p) => ({ nodeId: p.nodeId ?? null, url: p.url, region: p.region ?? null, bbox: p.bbox ?? null }));

  return NextResponse.json({
    nodeId: NODE_ID,
    nodeUrl: NODE_URL,
    version: NODE_VERSION,
    region: NODE_REGION,
    bbox: NODE_BBOX,
    publicKeyPem: process.env.NODE_PUBLIC_KEY ?? null,
    peers,
  });
}
