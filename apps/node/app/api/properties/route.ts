import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import type { NextRequest } from "next/server";

// GET /api/properties?q=<search>&feature=<fieldName>[,<fieldName>...]
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const featureParam = req.nextUrl.searchParams.get("feature")?.trim() ?? "";
  const features = featureParam ? featureParam.split(",").map((f) => f.trim()).filter(Boolean) : [];

  // Require at least a query or a feature filter — never return the full list
  if (!q && features.length === 0) {
    return NextResponse.json({ properties: [] });
  }

  const textFilter = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { location: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const featureFilter =
    features.length > 0
      ? {
          facts: {
            some: {
              fieldName: { in: features },
              value: "yes",
            },
          },
        }
      : {};

  const properties = await prisma.property.findMany({
    where: { ...textFilter, ...featureFilter },
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
  const authError = await requireAuth(req);
  if (authError) return authError;

  let body: { name?: string; location?: string; canonicalId?: string };
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

  // Use provided canonicalId or generate a local placeholder
  const canonicalId =
    body.canonicalId?.trim() ||
    `local:${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const property = await prisma.property.create({
    data: { name, location, canonicalId },
    select: { id: true, name: true, location: true, canonicalId: true },
  });

  return NextResponse.json({ property }, { status: 201 });
}
