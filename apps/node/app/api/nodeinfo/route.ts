import { NextResponse } from "next/server";
import { NODE_ID, NODE_URL, NODE_VERSION } from "@/lib/nodeInfo";
import { getNodeBbox, getNodeRegionLabel } from "@/lib/nodeSettings";
import { prisma } from "@/lib/prisma";
import {
  EXPORT_SCHEMA_VERSION,
  GOSSIP_PROTOCOL_VERSION,
  MIN_SUPPORTED_GOSSIP_PROTOCOL,
} from "@wikitraveler/core";

export { dynamic } from "@/lib/apiRoute";

/**
 * GET /api/nodeinfo
 *
 * Returns this node's public identity, public key, and known peers.
 * Clients/peers cache the public key here for RS256 JWT verification.
 */
export async function GET() {
  const [bbox, region, peerRows] = await Promise.all([
    getNodeBbox(),
    getNodeRegionLabel(),
    prisma.nodePeer.findMany({
      where: { isActive: true },
      select: { url: true, nodeId: true, region: true, bbox: true },
    }),
  ]);

  const peers = peerRows
    .filter((p) => p.nodeId !== NODE_ID)
    .map((p) => ({ nodeId: p.nodeId ?? null, url: p.url, region: p.region ?? null, bbox: p.bbox ?? null }));

  return NextResponse.json({
    nodeId: NODE_ID,
    nodeUrl: NODE_URL,
    version: NODE_VERSION,
    gossipProtocol: GOSSIP_PROTOCOL_VERSION,
    minGossipProtocol: MIN_SUPPORTED_GOSSIP_PROTOCOL,
    exportSchema: EXPORT_SCHEMA_VERSION,
    region,
    bbox,
    publicKeyPem: process.env.NODE_PUBLIC_KEY ?? null,
    peers,
    features: {
      communitySignals: true,
      passwordResetEmail: false,
    },
  });
}
