import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { collapseMapFacts, MAP_PIN_LIMIT } from "@/lib/mapPinFacts";
import { resolveEffectiveProperties } from "@/lib/propertyMetadata";
import { getNodeBbox } from "@/lib/nodeSettings";
import {
  getMapViewportPinLimit,
  propertyWhereInBbox,
  validateMapBbox,
} from "@/lib/mapQuery";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/properties/map?bbox=minLat,minLon,maxLat,maxLon&limit=
 * Optional: region=1 — use this node's configured bbox (Admin dashboard; skips viewport area cap).
 *
 * Unscoped map dumps are rejected (RFC-0002 M3).
 */
export async function GET(req: NextRequest) {
  if (process.env.GOSSIP_DEV !== "true") {
    const authError = await requireAuth(req);
    if (authError) return authError;
  }

  const useRegion = req.nextUrl.searchParams.get("region") === "1";
  let bboxRaw = req.nextUrl.searchParams.get("bbox");

  if (useRegion && !bboxRaw?.trim()) {
    bboxRaw = (await getNodeBbox()) ?? null;
    if (!bboxRaw) {
      return NextResponse.json(
        {
          code: "BBOX_REQUIRED",
          message: "No region bbox configured — set a region in Admin or pass bbox=",
        },
        { status: 400 }
      );
    }
  }

  const validated = validateMapBbox(bboxRaw, { skipAreaCheck: useRegion });
  if (!validated.ok) {
    const status = validated.code === "BBOX_TOO_LARGE" ? 400 : 400;
    return NextResponse.json(
      {
        code: validated.code,
        message: validated.message,
        areaKm2: validated.areaKm2,
        maxAreaKm2: validated.maxAreaKm2,
      },
      { status }
    );
  }

  const requestedLimit = parseInt(req.nextUrl.searchParams.get("limit") ?? "", 10);
  const pinCap = useRegion
    ? MAP_PIN_LIMIT
    : Math.min(
        MAP_PIN_LIMIT,
        Number.isFinite(requestedLimit) && requestedLimit > 0
          ? requestedLimit
          : getMapViewportPinLimit()
      );

  const geoWhere = propertyWhereInBbox(validated.bbox);

  const properties = await prisma.property.findMany({
    where: geoWhere,
    select: {
      id: true,
      canonicalId: true,
      name: true,
      location: true,
      lat: true,
      lon: true,
      facts: {
        select: { fieldName: true, value: true, tier: true },
      },
    },
    orderBy: { name: "asc" },
    take: pinCap,
  });

  const resolved = await resolveEffectiveProperties(properties);
  const mappable = resolved.filter((p) => p.effective.lat != null && p.effective.lon != null);

  const pins = mappable.map((p) => {
    const { facts, audited } = collapseMapFacts("facts" in p ? p.facts : []);
    return {
      id: p.id,
      name: p.effective.name,
      location: p.effective.location,
      lat: p.effective.lat,
      lon: p.effective.lon,
      audited,
      facts,
    };
  });

  return NextResponse.json({
    pins,
    truncated: properties.length >= pinCap,
    bbox: validated.bboxStr,
  });
}
