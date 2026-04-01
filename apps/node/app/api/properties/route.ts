import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import type { NextRequest } from "next/server";

// GET /api/properties?q=<search term>
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  const properties = await prisma.property.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { location: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true, location: true, canonicalId: true },
  });

  return NextResponse.json({ properties });
}

// POST /api/properties — create a new property (requires auditor JWT)
export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
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
