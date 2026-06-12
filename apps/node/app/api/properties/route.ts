import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

// GET /api/properties?q=&feature=&audited=&location=&ids=
export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const featureParam = req.nextUrl.searchParams.get("feature")?.trim() ?? "";
  const features = featureParam ? featureParam.split(",").map((f) => f.trim()).filter(Boolean) : [];
  const auditedParam = req.nextUrl.searchParams.get("audited");
  const locationFilter = req.nextUrl.searchParams.get("location")?.trim() ?? "";
  const idsParam = req.nextUrl.searchParams.get("ids")?.trim() ?? "";
  const ids = idsParam ? idsParam.split(",").map((id) => id.trim()).filter(Boolean) : [];

  const andFilters: Prisma.PropertyWhereInput[] = [];

  if (q) {
    andFilters.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
        { canonicalId: { contains: q, mode: "insensitive" } },
        { osmId: { contains: q, mode: "insensitive" } },
        { wheelmapId: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (locationFilter) {
    andFilters.push({
      location: { contains: locationFilter, mode: "insensitive" },
    });
  }

  if (ids.length > 0) {
    andFilters.push({
      OR: [
        { canonicalId: { in: ids } },
        { osmId: { in: ids } },
        { wheelmapId: { in: ids } },
      ],
    });
  }

  for (const feature of features) {
    andFilters.push({
      facts: {
        some: {
          fieldName: feature,
          value: "yes",
        },
      },
    });
  }

  if (auditedParam === "true") {
    andFilters.push({
      facts: {
        some: {
          tier: { in: ["VERIFIED", "CONFIRMED"] },
        },
      },
    });
  } else if (auditedParam === "false") {
    andFilters.push({
      facts: {
        none: {
          tier: { in: ["VERIFIED", "CONFIRMED"] },
        },
      },
    });
  }

  const where: Prisma.PropertyWhereInput =
    andFilters.length > 0 ? { AND: andFilters } : {};

  const properties = await prisma.property.findMany({
    where,
    orderBy: { name: "asc" },
    take: 30,
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

  return NextResponse.json({ properties });
}

// POST /api/properties — create a new property (requires auditor JWT)
export async function POST(req: NextRequest) {
  const authError = await requireRole(req, "AUDITOR");
  if (authError) return authError;

  let body: {
    name?: string;
    location?: string;
    canonicalId?: string;
    lat?: number;
    lon?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  const location = body.location?.trim();

  if (!name || !location) {
    return NextResponse.json(
      { message: "name and location are required" },
      { status: 422 }
    );
  }

  let lat: number | undefined;
  let lon: number | undefined;
  if (body.lat != null && body.lon != null) {
    lat = Number(body.lat);
    lon = Number(body.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json({ message: "Invalid lat/lon" }, { status: 422 });
    }
  }

  const canonicalId =
    body.canonicalId?.trim() ||
    `local:${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const property = await prisma.property.create({
    data: {
      name,
      location,
      canonicalId,
      ...(lat != null && lon != null ? { lat, lon } : {}),
    },
    select: { id: true, name: true, location: true, canonicalId: true, lat: true, lon: true },
  });

  return NextResponse.json({ property }, { status: 201 });
}
