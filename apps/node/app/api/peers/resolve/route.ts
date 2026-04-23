import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NODE_ID, NODE_URL, NODE_REGION, NODE_BBOX } from "@/lib/nodeInfo";
import { requireAuth } from "@/lib/auth";
import type { NextRequest } from "next/server";

/**
 * GET /api/peers/resolve?lat=<lat>&lon=<lon>
 *
 * Returns the best peer for a given coordinate.
 * First checks active NodePeers with a bbox that contains the point.
 * Falls back to this node if no peer matches.
 *
 * Clients use this to redirect queries to the right regional node.
 */
function parseBbox(raw: string | null): [number, number, number, number] | null {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  return parts as [number, number, number, number];
}

function containsPoint(bbox: string, lat: number, lon: number): boolean {
  const parsed = parseBbox(bbox);
  if (!parsed) return false;
  const [minLat, minLon, maxLat, maxLon] = parsed;
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lon = parseFloat(req.nextUrl.searchParams.get("lon") ?? "");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ message: "lat and lon query parameters are required" }, { status: 400 });
  }

  // Check if this node's own bbox covers the point
  if (NODE_BBOX && containsPoint(NODE_BBOX, lat, lon)) {
    return NextResponse.json({ nodeId: NODE_ID, url: NODE_URL, region: NODE_REGION, bbox: NODE_BBOX, matched: "self" });
  }

  // Search active peers with a bbox
  const peers = await prisma.nodePeer.findMany({
    where: { isActive: true, bbox: { not: null } },
    select: { url: true, nodeId: true, region: true, bbox: true },
  });

  for (const peer of peers) {
    if (peer.bbox && containsPoint(peer.bbox, lat, lon)) {
      return NextResponse.json({
        nodeId: peer.nodeId ?? null,
        url: peer.url,
        region: peer.region ?? null,
        bbox: peer.bbox,
        matched: "peer",
      });
    }
  }

  // No region match — return self as best-effort fallback
  return NextResponse.json({ nodeId: NODE_ID, url: NODE_URL, region: NODE_REGION, bbox: NODE_BBOX, matched: "fallback" });
}
