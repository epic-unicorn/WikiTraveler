import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPropertyFromWheeelmap } from "@/lib/wheelmap";
import type { NextRequest } from "next/server";

/**
 * GET /api/cron/wheelmap-sync
 *
 * Batch job that finds all properties with a wheelmapId and pulls fresh
 * accessibility data from the Wheelmap API for each, upserting facts at
 * OFFICIAL tier with sourceType WHEELMAP.
 *
 * Facts already at COMMUNITY or MESH_TRUTH tier are never downgraded.
 *
 * Protected by CRON_SECRET. Schedule alongside gossip and ai-scan.
 *
 * Requires WHEELMAP_API_KEY env var.
 *
 * Query params:
 *   - limit: max properties per run (default 30, max 100)
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.WHEELMAP_API_KEY) {
    return NextResponse.json(
      { message: "WHEELMAP_API_KEY is not configured — wheelmap-sync skipped." },
      { status: 503 }
    );
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(parseInt(limitParam ?? "30", 10) || 30, 100);

  const properties = await prisma.property.findMany({
    where: { wheelmapId: { not: null } },
    select: { id: true, name: true, wheelmapId: true },
    take: limit,
    orderBy: { updatedAt: "asc" }, // least-recently-updated first
  });

  if (properties.length === 0) {
    return NextResponse.json({
      message:
        "No properties have a wheelmapId set. " +
        "Set wheelmapId on a property record or use GET /api/properties?q=... " +
        "combined with PATCH /api/properties/:id to link them.",
      processed: 0,
    });
  }

  const results: Array<{
    propertyId: string;
    name: string;
    ok: boolean;
    factsUpserted?: number;
    skipped?: number;
    error?: string;
  }> = [];

  for (const property of properties) {
    try {
      const summary = await syncPropertyFromWheeelmap(
        property.id,
        property.wheelmapId! // guaranteed non-null by the query
      );
      results.push({
        propertyId: property.id,
        name: property.name,
        ok: true,
        factsUpserted: summary.factsUpserted,
        skipped: summary.skipped,
      });
    } catch (err) {
      results.push({
        propertyId: property.id,
        name: property.name,
        ok: false,
        error: String(err),
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const totalUpserted = results.reduce((sum, r) => sum + (r.factsUpserted ?? 0), 0);

  return NextResponse.json({
    processed: results.length,
    succeeded,
    failed: results.length - succeeded,
    totalFactsUpserted: totalUpserted,
    results,
  });
}
