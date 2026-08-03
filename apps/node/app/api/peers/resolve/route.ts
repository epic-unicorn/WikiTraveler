import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NODE_ID, NODE_URL } from "@/lib/nodeInfo";
import { getNodeBbox, getNodeRegionLabel } from "@/lib/nodeSettings";
import { containsPoint, parseBbox } from "@/lib/bbox";
import { requireAuth } from "@/lib/auth";
import type { NextRequest } from "next/server";


export const dynamic = "force-dynamic";
/**
 * GET /api/peers/resolve?lat=<lat>&lon=<lon>
 *
 * Returns the best peer for a given coordinate.
 * First checks active NodePeers with a bbox that contains the point.
 * Falls back to this node if no peer matches.
 */
export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lon = parseFloat(req.nextUrl.searchParams.get("lon") ?? "");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ message: "lat and lon query parameters are required" }, { status: 400 });
  }

  const [selfBbox, region] = await Promise.all([getNodeBbox(), getNodeRegionLabel()]);
  const parsedSelf = parseBbox(selfBbox);

  if (parsedSelf && containsPoint(parsedSelf, lat, lon)) {
    return NextResponse.json({
      nodeId: NODE_ID,
      url: NODE_URL,
      region,
      bbox: selfBbox,
      matched: "self",
    });
  }

  const peers = await prisma.nodePeer.findMany({
    where: { isActive: true, bbox: { not: null } },
    select: { url: true, nodeId: true, region: true, bbox: true },
  });

  for (const peer of peers) {
    const pb = parseBbox(peer.bbox);
    if (pb && containsPoint(pb, lat, lon)) {
      return NextResponse.json({
        nodeId: peer.nodeId ?? null,
        url: peer.url,
        region: peer.region ?? null,
        bbox: peer.bbox,
        matched: "peer",
      });
    }
  }

  return NextResponse.json({
    nodeId: NODE_ID,
    url: NODE_URL,
    region,
    bbox: selfBbox,
    matched: "fallback",
  });
}
