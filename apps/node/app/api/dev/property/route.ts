import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
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

/**
 * Dev-only property CRUD for the gossip lab (no auth, GOSSIP_DEV gated).
 *
 * Mirrors /api/properties + /api/properties/[id] but without authentication so
 * lab scripts can exercise create / metadata-override edit / delete and watch
 * the changes gossip between nodes.
 *
 *   GET    /api/dev/property                      → list (base + effective + overrides)
 *   GET    /api/dev/property?canonicalId=lab:x    → single resolved property
 *   POST   /api/dev/property                      → upsert base property by canonicalId
 *   PATCH  /api/dev/property                      → write metadata overrides (+ peer push)
 *   DELETE /api/dev/property?id=…|?canonicalId=…  → delete property
 */

function devGuard(): NextResponse | null {
  if (process.env.GOSSIP_DEV !== "true" && process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return null;
}

function shape(resolved: ReturnType<typeof resolveOne>, extra: { id: string; canonicalId: string; osmId: string | null; dataSource?: string }) {
  return {
    id: extra.id,
    canonicalId: extra.canonicalId,
    osmId: extra.osmId,
    dataSource: extra.dataSource,
    name: resolved.effective.name,
    location: resolved.effective.location,
    lat: resolved.effective.lat,
    lon: resolved.effective.lon,
    baseMetadata: resolved.base,
    effectiveMetadata: resolved.effective,
    metadataOverrides: resolved.overrides,
    metadataProvenance: buildFieldProvenance(resolved, NODE_ID),
  };
}

export async function GET(req: NextRequest) {
  const blocked = devGuard();
  if (blocked) return blocked;

  const canonicalId = req.nextUrl.searchParams.get("canonicalId");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "20");

  const properties = await prisma.property.findMany({
    where: canonicalId ? { canonicalId } : undefined,
    orderBy: { name: "asc" },
    take: canonicalId ? 1 : Math.min(Math.max(limit, 1), 100),
    select: {
      id: true,
      canonicalId: true,
      name: true,
      location: true,
      lat: true,
      lon: true,
      osmId: true,
      dataSource: true,
    },
  });

  const overrideMap = await loadOverridesForCanonicalIds(properties.map((p) => p.canonicalId));
  const items = properties.map((p) =>
    shape(resolveOne(p, overrideMap.get(p.canonicalId) ?? []), p)
  );

  if (canonicalId) {
    if (items.length === 0) {
      return NextResponse.json({ message: "Property not found" }, { status: 404 });
    }
    return NextResponse.json({ property: items[0] });
  }

  return NextResponse.json({ properties: items, nodeId: NODE_ID });
}

export async function POST(req: NextRequest) {
  const blocked = devGuard();
  if (blocked) return blocked;

  let body: {
    name?: string;
    location?: string;
    canonicalId?: string;
    lat?: number | null;
    lon?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  const location = body.location?.trim();
  if (!name || !location) {
    return NextResponse.json({ message: "name and location are required" }, { status: 422 });
  }

  const canonicalId =
    body.canonicalId?.trim() ||
    `lab:${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const lat = body.lat ?? null;
  const lon = body.lon ?? null;

  const property = await prisma.property.upsert({
    where: { canonicalId },
    update: { name, location, lat, lon },
    create: { canonicalId, name, location, lat, lon },
    select: {
      id: true,
      canonicalId: true,
      name: true,
      location: true,
      lat: true,
      lon: true,
      osmId: true,
      dataSource: true,
    },
  });

  const overrideMap = await loadOverridesForCanonicalIds([property.canonicalId]);
  const resolved = resolveOne(property, overrideMap.get(property.canonicalId) ?? []);
  return NextResponse.json({ property: shape(resolved, property) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const blocked = devGuard();
  if (blocked) return blocked;

  let body: {
    id?: string;
    canonicalId?: string;
    name?: string;
    location?: string;
    lat?: number | null;
    lon?: number | null;
    resetFields?: PropertyMetadataFieldName[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const where = body.id
    ? { id: body.id }
    : body.canonicalId
      ? { canonicalId: body.canonicalId }
      : null;
  if (!where) {
    return NextResponse.json({ message: "id or canonicalId is required" }, { status: 400 });
  }

  const existing = await prisma.property.findUnique({ where });
  if (!existing) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  let overrides;
  if (body.resetFields?.length) {
    overrides = await resetLocalMetadataFields({
      property: existing,
      fields: body.resetFields,
      submittedBy: "gossip-lab",
    });
  } else {
    const fields: Partial<Record<PropertyMetadataFieldName, string>> = {};
    if (body.name !== undefined) fields.name = String(body.name).trim();
    if (body.location !== undefined) fields.location = String(body.location).trim();
    if (body.lat !== undefined && body.lat !== null) fields.lat = String(body.lat);
    if (body.lon !== undefined && body.lon !== null) fields.lon = String(body.lon);

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ message: "No metadata fields to update" }, { status: 422 });
    }
    overrides = await upsertLocalMetadataOverrides({
      property: existing,
      fields,
      submittedBy: "gossip-lab",
    });
  }

  void pushMetadataOverridesToPeers(overrides);

  const overrideMap = await loadOverridesForCanonicalIds([existing.canonicalId]);
  const resolved = resolveOne(existing, overrideMap.get(existing.canonicalId) ?? overrides);
  return NextResponse.json({
    property: shape(resolved, existing),
    pushed: overrides.length,
  });
}

export async function DELETE(req: NextRequest) {
  const blocked = devGuard();
  if (blocked) return blocked;

  const id = req.nextUrl.searchParams.get("id");
  const canonicalId = req.nextUrl.searchParams.get("canonicalId");
  const where = id ? { id } : canonicalId ? { canonicalId } : null;
  if (!where) {
    return NextResponse.json({ message: "id or canonicalId query param is required" }, { status: 400 });
  }

  const existing = await prisma.property.findUnique({
    where,
    select: { id: true, canonicalId: true, name: true },
  });
  if (!existing) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  await prisma.property.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true, deleted: existing });
}
