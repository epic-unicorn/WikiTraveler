import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gunzip } from "zlib";
import { promisify } from "util";
import { requireAuth } from "@/lib/auth";
import type { NextRequest } from "next/server";
import type { Tier, SourceType } from "@wikitraveler/core";

const gunzipAsync = promisify(gunzip);

interface ExportProperty {
  id: string;
  canonicalId: string;
  name: string;
  location: string;
  lat: number | null;
  lon: number | null;
  dataSource: string;
  osmId: string | null;
  wheelmapId: string | null;
}

interface ExportFact {
  propertyId: string;
  fieldName: string;
  value: string;
  tier: string;
  sourceType: string;
  sourceNodeId: string;
  submittedBy: string | null;
  signatureHash: string | null;
  timestamp: string;
}

interface ExportPayload {
  schemaVersion: number;
  exportedAt: string;
  properties: ExportProperty[];
  facts: ExportFact[];
}

/**
 * POST /api/import
 *
 * Ingests a gzip-compressed export produced by GET /api/export on a peer node.
 * Use this to "hydrate" a fresh node without fetching records one-by-one.
 *
 * Request body: the raw .json.gz binary (Content-Type: application/gzip)
 *
 * Behaviour:
 * - Properties are upserted by canonicalId (peer's internal IDs are ignored).
 * - Facts follow the standard tier protection — VERIFIED / CONFIRMED facts on
 *   this node are never downgraded by incoming OFFICIAL / AI_GUESS data.
 * - Importing the same export twice is idempotent.
 *
 * JWT-protected — node operators only.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/gzip")) {
    return NextResponse.json(
      { message: "Expected Content-Type: application/gzip" },
      { status: 415 }
    );
  }

  let payload: ExportPayload;
  try {
    const compressed = Buffer.from(await req.arrayBuffer());
    const json = await gunzipAsync(compressed);
    payload = JSON.parse(json.toString("utf-8")) as ExportPayload;
  } catch {
    return NextResponse.json(
      { message: "Failed to decompress or parse import file" },
      { status: 400 }
    );
  }

  if (!Array.isArray(payload.properties) || !Array.isArray(payload.facts)) {
    return NextResponse.json(
      { message: "Invalid export format — missing properties or facts arrays" },
      { status: 422 }
    );
  }

  // ── Upsert properties ──────────────────────────────────────────────────────
  const idMap = new Map<string, string>(); // peer id → local id

  for (const p of payload.properties) {
    const local = await prisma.property.upsert({
      where: { canonicalId: p.canonicalId },
      update: {
        name: p.name,
        location: p.location,
        lat: p.lat,
        lon: p.lon,
        ...(p.osmId ? { osmId: p.osmId } : {}),
        ...(p.wheelmapId ? { wheelmapId: p.wheelmapId } : {}),
      },
      create: {
        canonicalId: p.canonicalId,
        name: p.name,
        location: p.location,
        lat: p.lat,
        lon: p.lon,
        osmId: p.osmId,
        wheelmapId: p.wheelmapId,
        dataSource: p.dataSource ?? "IMPORTED_OSM",
      },
      select: { id: true },
    });
    idMap.set(p.id, local.id);
  }

  // ── Upsert facts (tier-protected) ─────────────────────────────────────────
  let factsImported = 0;
  let factsProtected = 0;

  // Pre-load protected fields to avoid per-fact queries
  const protectedMap = new Map<string, Set<string>>(); // propertyId → Set<fieldName>
  const localIds = [...idMap.values()];
  const existingFacts = await prisma.accessibilityFact.findMany({
    where: {
      propertyId: { in: localIds },
      tier: { in: ["VERIFIED", "CONFIRMED"] },
    },
    select: { propertyId: true, fieldName: true },
  });
  for (const f of existingFacts) {
    if (!protectedMap.has(f.propertyId)) protectedMap.set(f.propertyId, new Set());
    protectedMap.get(f.propertyId)!.add(f.fieldName);
  }

  for (const f of payload.facts) {
    const localPropertyId = idMap.get(f.propertyId);
    if (!localPropertyId) continue; // property wasn't in this export

    if (protectedMap.get(localPropertyId)?.has(f.fieldName)) {
      factsProtected++;
      continue;
    }

    await prisma.accessibilityFact.upsert({
      where: {
        propertyId_fieldName_sourceNodeId: {
          propertyId: localPropertyId,
          fieldName: f.fieldName,
          sourceNodeId: f.sourceNodeId,
        },
      },
      update: { value: f.value, tier: f.tier as Tier, timestamp: new Date(f.timestamp) },
      create: {
        propertyId: localPropertyId,
        fieldName: f.fieldName,
        value: f.value,
        tier: f.tier as Tier,
        sourceType: f.sourceType as SourceType,
        sourceNodeId: f.sourceNodeId,
        submittedBy: f.submittedBy,
        signatureHash: f.signatureHash,
        timestamp: new Date(f.timestamp),
      },
    });
    factsImported++;
  }

  return NextResponse.json({
    ok: true,
    propertiesUpserted: idMap.size,
    factsImported,
    factsProtected,
  });
}
