import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/resolve?lat=&lon=
 *
 * Returns the best active node to query for a given coordinate.
 * Picks the first active node whose bbox contains the point.
 * Falls back to any active node if none match.
 *
 * Returns: { nodeId, url, region, bbox } | { message } (404)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lon = parseFloat(searchParams.get("lon") ?? "");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ message: "lat and lon are required numbers" }, { status: 400 });
  }

  const activeNodes = await prisma.registryNode.findMany({
    where: { isActive: true },
    select: { nodeId: true, url: true, region: true, bbox: true },
    orderBy: { lastHeartbeat: "desc" },
  });

  if (activeNodes.length === 0) {
    return NextResponse.json({ message: "No active nodes registered" }, { status: 404 });
  }

  // Find all nodes whose bbox contains the point, then pick the most specific
  // (smallest area). This prevents a "world node" from shadowing regional nodes.
  // bbox format: "minLat,minLon,maxLat,maxLon"
  const matches = activeNodes.filter((node) => {
    if (!node.bbox) return false;
    const parts = node.bbox.split(",").map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return false;
    const [minLat, minLon, maxLat, maxLon] = parts;
    return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
  });

  // Sort by bbox area ascending — smallest (most specific) first
  matches.sort((a, b) => {
    const area = (n: typeof a) => {
      const [minLat, minLon, maxLat, maxLon] = n.bbox!.split(",").map(Number);
      return (maxLat - minLat) * (maxLon - minLon);
    };
    return area(a) - area(b);
  });

  const match = matches[0] ?? null;

  const result = match ?? activeNodes[0];
  console.log(`[registry] resolve lat=${lat} lon=${lon} → ${result.nodeId} (${match ? "bbox match" : "fallback"})`);
  return NextResponse.json({
    nodeId: result.nodeId,
    url: result.url,
    region: result.region,
    bbox: result.bbox,
    matched: !!match,
  });
}
