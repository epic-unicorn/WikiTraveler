import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { collapseMapFacts, MAP_PIN_LIMIT } from "@/lib/mapPinFacts";
import { resolveEffectiveProperties } from "@/lib/propertyMetadata";
import type { NextRequest } from "next/server";


export { dynamic } from "@/lib/apiRoute";
// GET /api/properties/map — returns geo-tagged properties with key facts + audited flag
export async function GET(req: NextRequest) {
  if (process.env.GOSSIP_DEV !== "true") {
    const authError = await requireAuth(req);
    if (authError) return authError;
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
      facts: {
        select: { fieldName: true, value: true, tier: true },
      },
    },
    orderBy: { name: "asc" },
    take: MAP_PIN_LIMIT,
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

  return NextResponse.json({ pins, truncated: properties.length >= MAP_PIN_LIMIT });
}
