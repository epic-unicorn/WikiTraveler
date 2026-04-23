import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import type { NextRequest } from "next/server";

const KEY_FIELDS = ["step_free_entrance", "accessible_bathroom", "elevator_present", "ramp_present", "parking_accessible"];
const TIER_RANK: Record<string, number> = { OFFICIAL: 0, AI_GUESS: 1, VERIFIED: 2, CONFIRMED: 3 };
const AUDITED_TIERS = new Set(["VERIFIED", "CONFIRMED"]);

// GET /api/properties/map — returns all properties that have lat/lon + key accessibility facts
export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

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
    // Collapse to best tier per field (display: KEY_FIELDS only)
    const best = new Map<string, { value: string; tier: string }>();
    for (const f of p.facts) {
      if (!KEY_FIELDS.includes(f.fieldName)) continue;
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
