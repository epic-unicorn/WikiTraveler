import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { forwardGeocode } from "@/lib/nominatim";
import { NODE_ID } from "@/lib/nodeInfo";
import {
  loadOverridesForCanonicalIds,
  resetLocalMetadataFields,
  resolveOne,
  upsertLocalMetadataOverrides,
  buildFieldProvenance,
  type PropertyMetadataFieldName,
} from "@/lib/propertyMetadata";
import { pushMetadataOverridesToPeers } from "@/lib/push";
import type { NextRequest } from "next/server";

type RouteParams = { params: { id: string } };

function usernameFromReq(req: NextRequest): string | null {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
    );
    return (payload.username as string | undefined) ?? null;
  } catch {
    return null;
  }
}

// GET /api/properties/:id
export async function GET(req: NextRequest, { params }: RouteParams) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const property = await prisma.property.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      location: true,
      canonicalId: true,
      lat: true,
      lon: true,
      dataSource: true,
      osmId: true,
      wheelmapId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  const overrideMap = await loadOverridesForCanonicalIds([property.canonicalId]);
  const resolved = resolveOne(property, overrideMap.get(property.canonicalId) ?? []);

  return NextResponse.json({
    property: {
      ...property,
      name: resolved.effective.name,
      location: resolved.effective.location,
      lat: resolved.effective.lat,
      lon: resolved.effective.lon,
      baseMetadata: resolved.base,
      effectiveMetadata: resolved.effective,
      metadataOverrides: resolved.overrides,
      metadataProvenance: buildFieldProvenance(resolved, NODE_ID),
    },
  });
}

// PATCH /api/properties/:id
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  let body: {
    name?: string;
    location?: string;
    canonicalId?: string;
    lat?: number | null;
    lon?: number | null;
    resetFields?: PropertyMetadataFieldName[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.property.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  const submittedBy = usernameFromReq(req);

  if (body.resetFields?.length) {
    const overrides = await resetLocalMetadataFields({
      property: existing,
      fields: body.resetFields,
      submittedBy,
    });
    void pushMetadataOverridesToPeers(overrides);
    const resolved = resolveOne(existing, overrides);
    return NextResponse.json({
      property: {
        id: existing.id,
        canonicalId: existing.canonicalId,
        dataSource: existing.dataSource,
        osmId: existing.osmId,
        name: resolved.effective.name,
        location: resolved.effective.location,
        lat: resolved.effective.lat,
        lon: resolved.effective.lon,
        baseMetadata: resolved.base,
        effectiveMetadata: resolved.effective,
        metadataOverrides: overrides,
        metadataProvenance: buildFieldProvenance(resolved, NODE_ID),
      },
    });
  }

  let lat = body.lat !== undefined ? body.lat : existing.lat;
  let lon = body.lon !== undefined ? body.lon : existing.lon;
  const location = body.location?.trim() ?? existing.location;

  if ((lat == null || lon == null) && location) {
    const geo = await forwardGeocode(location);
    if (geo) {
      lat = geo.lat;
      lon = geo.lon;
    }
  }

  if (lat == null || lon == null) {
    return NextResponse.json(
      { message: "lat/lon required for map visibility — pick on map or use a geocodable address" },
      { status: 422 }
    );
  }

  const fields: Partial<Record<PropertyMetadataFieldName, string>> = {};
  if (body.name !== undefined) fields.name = body.name.trim();
  if (body.location !== undefined) fields.location = location;
  fields.lat = String(lat);
  fields.lon = String(lon);

  const overrides = await upsertLocalMetadataOverrides({
    property: existing,
    fields,
    submittedBy,
  });
  void pushMetadataOverridesToPeers(overrides);

  if (body.canonicalId?.trim() && !existing.osmId) {
    await prisma.property.update({
      where: { id: existing.id },
      data: { canonicalId: body.canonicalId.trim() },
    });
    existing.canonicalId = body.canonicalId.trim();
  }

  const overrideMap = await loadOverridesForCanonicalIds([existing.canonicalId]);
  const resolved = resolveOne(existing, overrideMap.get(existing.canonicalId) ?? overrides);

  return NextResponse.json({
    property: {
      id: existing.id,
      canonicalId: existing.canonicalId,
      dataSource: existing.dataSource,
      osmId: existing.osmId,
      name: resolved.effective.name,
      location: resolved.effective.location,
      lat: resolved.effective.lat,
      lon: resolved.effective.lon,
      baseMetadata: resolved.base,
      effectiveMetadata: resolved.effective,
      metadataOverrides: resolved.overrides,
      metadataProvenance: buildFieldProvenance(resolved, NODE_ID),
    },
  });
}

// DELETE /api/properties/:id
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const existing = await prisma.property.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, osmId: true, dataSource: true },
  });

  if (!existing) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  await prisma.property.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true, deleted: existing });
}
