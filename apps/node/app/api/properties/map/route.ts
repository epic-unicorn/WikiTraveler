import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { collapseMapFacts, MAP_PIN_LIMIT } from "@/lib/mapPinFacts";
import type { NextRequest } from "next/server";

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

  const pins = properties.map((p) => {
    const { facts, audited } = collapseMapFacts(p.facts);
    return {
      id: p.id,
      name: p.name,
      location: p.location,
      lat: p.lat,
      lon: p.lon,
      audited,
      facts,
    };
  });

  return NextResponse.json({ pins, truncated: properties.length >= MAP_PIN_LIMIT });
}
