import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { resolveEffectiveProperties } from "@/lib/propertyMetadata";
import type { NextRequest } from "next/server";


export { dynamic } from "@/lib/apiRoute";
/**
 * GET /api/export/geojson
 * Mappable properties as GeoJSON FeatureCollection (ADMIN or CRON_SECRET).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (cronSecret) {
    if (auth !== `Bearer ${cronSecret}`) {
      const adminError = await requireRole(req, "ADMIN");
      if (adminError) return adminError;
    }
  } else {
    const adminError = await requireRole(req, "ADMIN");
    if (adminError) return adminError;
  }

  const properties = await prisma.property.findMany({
    where: { lat: { not: null }, lon: { not: null } },
    select: {
      id: true,
      canonicalId: true,
      name: true,
      location: true,
      lat: true,
      lon: true,
      osmId: true,
      dataSource: true,
    },
    orderBy: { name: "asc" },
  });

  const resolved = await resolveEffectiveProperties(properties);
  const features = resolved
    .filter((p) => p.effective.lat != null && p.effective.lon != null)
    .map((p) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [p.effective.lon!, p.effective.lat!],
      },
      properties: {
        id: p.id,
        canonicalId: p.canonicalId,
        name: p.effective.name,
        location: p.effective.location,
        osmId: p.osmId,
        dataSource: p.dataSource,
      },
    }));

  return NextResponse.json({
    type: "FeatureCollection",
    features,
  });
}
