import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

/**
 * GET /v1/nodes
 *
 * List active nodes in the registry.
 *
 * Query parameters:
 *   - region: string (optional) — filter by region
 *   - limit: number (optional, default 100, max 500) — max results to return
 *
 * Returns:
 *   { nodes: [{ nodeId, url, region, lastHeartbeat }] }
 */
export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region");
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(parseInt(limitParam ?? "100", 10) || 100, 500);

  try {
    const nodes = await prisma.registryNode.findMany({
      where: {
        isActive: true,
        ...(region && { region }),
      },
      select: {
        nodeId: true,
        url: true,
        region: true,
        lastHeartbeat: true,
      },
      orderBy: { lastHeartbeat: "desc" },
      take: limit,
    });

    return NextResponse.json({ nodes });
  } catch (err) {
    console.error("[registry] List failed:", err);
    return NextResponse.json({ message: "List failed" }, { status: 500 });
  }
}
