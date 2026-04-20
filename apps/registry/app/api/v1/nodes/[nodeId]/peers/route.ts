import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /v1/nodes/:nodeId/peers
 *
 * Get peer recommendations for a given node.
 * Returns up to 5 other active nodes (excluding the requesting node itself).
 *
 * Query parameters:
 *   - sameRegion: boolean (optional) — if true, prefer nodes in the same region
 *
 * Returns:
 *   { peers: [{ nodeId, url, region }] }
 */
export async function GET(
  req: Request,
  { params }: { params: { nodeId: string } }
) {
  const { nodeId } = params;
  const sameRegionParam = new URL(req.url).searchParams.get("sameRegion") === "true";

  try {
    // Get the requesting node's region
    const requestingNode = await prisma.registryNode.findUnique({
      where: { nodeId },
      select: { region: true },
    });

    if (!requestingNode) {
      return NextResponse.json({ message: "Node not found" }, { status: 404 });
    }

    // Get other active nodes, optionally filtered by region
    const peers = await prisma.registryNode.findMany({
      where: {
        isActive: true,
        nodeId: { not: nodeId },
        ...(sameRegionParam && requestingNode.region && { region: requestingNode.region }),
      },
      select: {
        nodeId: true,
        url: true,
        region: true,
      },
      orderBy: { lastHeartbeat: "desc" },
      take: 5,
    });

    console.log(`[registry] peers ${nodeId} sameRegion=${sameRegionParam} → ${peers.length} result(s)`);
    return NextResponse.json({ peers });
  } catch (err) {
    console.error("[registry] Peers lookup failed:", err);
    return NextResponse.json({ message: "Lookup failed" }, { status: 500 });
  }
}
