import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";


export const dynamic = "force-dynamic";
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/properties/nearby?lat=&lon=&radiusKm=1&limit=30&feature=&audited=
export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ message: "lat and lon are required" }, { status: 422 });
  }

  let radiusKm = Number(req.nextUrl.searchParams.get("radiusKm") ?? "1");
  if (!Number.isFinite(radiusKm)) radiusKm = 1;
  radiusKm = Math.min(10, Math.max(0.1, radiusKm));

  let limit = Number(req.nextUrl.searchParams.get("limit") ?? "30");
  if (!Number.isFinite(limit)) limit = 30;
  limit = Math.min(30, Math.max(1, Math.floor(limit)));

  const featureParam = req.nextUrl.searchParams.get("feature")?.trim() ?? "";
  const features = featureParam ? featureParam.split(",").map((f) => f.trim()).filter(Boolean) : [];
  const auditedParam = req.nextUrl.searchParams.get("audited");

  const andFilters: Prisma.PropertyWhereInput[] = [
    { lat: { not: null } },
    { lon: { not: null } },
  ];

  for (const feature of features) {
    andFilters.push({
      facts: {
        some: { fieldName: feature, value: "yes" },
      },
    });
  }

  if (auditedParam === "true") {
    andFilters.push({
      facts: { some: { tier: { in: ["VERIFIED", "CONFIRMED"] } } },
    });
  } else if (auditedParam === "false") {
    andFilters.push({
      facts: { none: { tier: { in: ["VERIFIED", "CONFIRMED"] } } },
    });
  }

  const candidates = await prisma.property.findMany({
    where: { AND: andFilters },
    select: {
      id: true,
      name: true,
      location: true,
      canonicalId: true,
      lat: true,
      lon: true,
      facts: {
        select: { fieldName: true, value: true, tier: true, sourceType: true },
      },
    },
  });

  const radiusM = radiusKm * 1000;
  const withDistance = candidates
    .map((p) => ({
      ...p,
      distanceM: haversineM(lat, lon, p.lat!, p.lon!),
    }))
    .filter((p) => p.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);

  return NextResponse.json({ properties: withDistance });
}
