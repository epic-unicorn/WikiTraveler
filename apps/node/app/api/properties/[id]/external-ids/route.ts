import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { syncPropertyFromWheeelmap, findWheelmapNode } from "@/lib/wheelmap";
import type { NextRequest } from "next/server";

/**
 * PATCH /api/properties/:id/external-ids
 *
 * Links a property to external system IDs (osmId, wheelmapId) and optionally
 * kicks off an immediate Wheelmap sync.
 *
 * JWT-protected — node operators only.
 *
 * Request body (at least one required):
 * {
 *   "osmId": "12345678",         // OpenStreetMap node ID
 *   "wheelmapId": "12345678",    // Wheelmap node ID (same as OSM node ID for places)
 *   "syncNow": true              // optional: immediately pull from Wheelmap after linking
 * }
 *
 * GET /api/properties/:id/external-ids
 *
 * Returns the current external IDs for the property.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const property = await prisma.property.findUnique({
    where: { id: params.id },
    select: { id: true, osmId: true, wheelmapId: true },
  });
  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }
  return NextResponse.json(property);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireRole(req, "AUDITOR");
  if (authError) return authError;

  let body: { osmId?: string; wheelmapId?: string; syncNow?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (!body.osmId && !body.wheelmapId) {
    return NextResponse.json(
      { message: "Provide at least one of: osmId, wheelmapId" },
      { status: 400 }
    );
  }

  const property = await prisma.property.findUnique({
    where: { id: params.id },
  });
  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  const updated = await prisma.property.update({
    where: { id: params.id },
    data: {
      ...(body.osmId !== undefined ? { osmId: body.osmId } : {}),
      ...(body.wheelmapId !== undefined ? { wheelmapId: body.wheelmapId } : {}),
    },
    select: { id: true, name: true, osmId: true, wheelmapId: true },
  });

  let syncResult = null;
  if (body.syncNow && updated.wheelmapId) {
    if (!process.env.WHEELMAP_API_KEY) {
      return NextResponse.json({
        ...updated,
        syncResult: { ok: false, error: "WHEELMAP_API_KEY is not configured on this node." },
      });
    }
    try {
      syncResult = await syncPropertyFromWheeelmap(params.id, updated.wheelmapId);
    } catch (err) {
      syncResult = { ok: false, error: String(err) };
    }
  }

  return NextResponse.json({ ...updated, syncResult });
}

/**
 * POST /api/properties/:id/external-ids/discover
 *
 * Attempts to auto-discover a matching Wheelmap node by searching within
 * a bounding box around the provided coordinates.
 *
 * Request body:
 * {
 *   "lat": 52.52,
 *   "lon": 13.405,
 *   "radiusKm": 0.2   // optional, default 0.2
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  if (!process.env.WHEELMAP_API_KEY) {
    return NextResponse.json(
      { message: "WHEELMAP_API_KEY is not configured on this node." },
      { status: 503 }
    );
  }

  let body: { lat?: number; lon?: number; radiusKm?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.lat !== "number" || typeof body.lon !== "number") {
    return NextResponse.json({ message: "lat and lon are required (numbers)" }, { status: 400 });
  }

  const property = await prisma.property.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  const r = (body.radiusKm ?? 0.2) / 111; // 1 degree ≈ 111 km
  const bbox: [number, number, number, number] = [
    body.lon - r,
    body.lat - r,
    body.lon + r,
    body.lat + r,
  ];

  try {
    const wheelmapId = await findWheelmapNode(property.name, bbox);
    if (!wheelmapId) {
      return NextResponse.json({ found: false, message: "No matching Wheelmap node found in bbox." });
    }

    const updated = await prisma.property.update({
      where: { id: params.id },
      data: { wheelmapId, osmId: wheelmapId },
      select: { id: true, name: true, osmId: true, wheelmapId: true },
    });

    return NextResponse.json({ found: true, ...updated });
  } catch (err) {
    return NextResponse.json({ message: String(err) }, { status: 502 });
  }
}
