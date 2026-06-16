import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import type { NextRequest } from "next/server";

const TIER_RANK: Record<string, number> = { OFFICIAL: 0, AI_GUESS: 1, VERIFIED: 2, CONFIRMED: 3 };
const AUDITED_TIERS = new Set(["VERIFIED", "CONFIRMED"]);

// GET /api/properties/map — returns all properties that have lat/lon + accessibility facts
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
  });

  const pins = properties.map((p) => {
    // Best tier per field — same collapse as the property detail page
    const best = new Map<string, { value: string; tier: string }>();
    for (const f of p.facts) {
      const ex = best.get(f.fieldName);
      if (!ex || (TIER_RANK[f.tier] ?? 0) > (TIER_RANK[ex.tier] ?? 0)) {
        best.set(f.fieldName, { value: f.value, tier: f.tier });
      }
    }
    return {
      id: p.id,
      name: p.name,
      location: p.location,
      lat: p.lat,
      lon: p.lon,
      // audited = any fact (any field) with VERIFIED or CONFIRMED tier
      audited: p.facts.some((f) => AUDITED_TIERS.has(f.tier)),
      facts: Object.fromEntries(best) as Record<string, { value: string; tier: string }>,
    };
  });

  return NextResponse.json({ pins });
}
