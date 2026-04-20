import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/properties/map — returns all properties that have lat/lon
export async function GET() {
  const pins = await prisma.property.findMany({
    where: {
      lat: { not: null },
      lon: { not: null },
    },
    select: { id: true, name: true, lat: true, lon: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ pins });
}
