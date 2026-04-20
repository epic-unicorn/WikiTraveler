import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mergeGossipDelta } from "@wikitraveler/core";
import { createHash } from "crypto";
import type { GossipDelta, Tier, SourceType } from "@wikitraveler/core";

// ---------------------------------------------------------------------------
// BBox guard — parse OSM_BBOX and return a filter function.
// bbox format: "minLat,minLon,maxLat,maxLon"
// ---------------------------------------------------------------------------
function makeBboxFilter(): ((lat: number | null | undefined, lon: number | null | undefined) => boolean) | null {
  const raw = process.env.OSM_BBOX;
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  const [minLat, minLon, maxLat, maxLon] = parts;
  return (lat, lon) => {
    if (lat == null || lon == null) return true; // no coords → allow (can't verify)
    return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
  };
}

// POST /api/gossip/ingest
export async function POST(req: Request) {
  let delta: GossipDelta;
  try {
    delta = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (!delta.fromNodeId || !Array.isArray(delta.facts)) {
    return NextResponse.json(
      { message: "Invalid delta: fromNodeId and facts[] are required" },
      { status: 400 }
    );
  }

  // ------------------------------------------------------------------
  // 1. Upsert any properties that arrived with the delta.
  //    Filter out properties outside this node's bbox to prevent a
  //    world-node (or misconfigured peer) from bloating our database.
  // ------------------------------------------------------------------
  const bboxFilter = makeBboxFilter();

  const allowedProperties = Array.isArray(delta.properties)
    ? delta.properties.filter((p) => !bboxFilter || bboxFilter(p.lat, p.lon))
    : [];

  const allowedPropertyIds = new Set(allowedProperties.map((p) => p.id));

  // Also filter facts to only those belonging to allowed properties
  const allowedFacts = delta.facts.filter((f) => !bboxFilter || allowedPropertyIds.has(f.propertyId));

  if (bboxFilter && allowedProperties.length < (delta.properties?.length ?? 0)) {
    const skipped = (delta.properties?.length ?? 0) - allowedProperties.length;
    console.info(`[ingest] Skipped ${skipped} out-of-bbox properties from ${delta.fromNodeId}`);
  }

  if (allowedProperties.length > 0) {
    await Promise.all(
      allowedProperties.map((p) =>
        prisma.property.upsert({
          where: { canonicalId: p.canonicalId },
          update: {
            name: p.name,
            location: p.location,
            osmId: p.osmId ?? undefined,
            wheelmapId: p.wheelmapId ?? undefined,
          },
          create: {
            id: p.id,
            canonicalId: p.canonicalId,
            name: p.name,
            location: p.location,
            osmId: p.osmId,
            wheelmapId: p.wheelmapId,
          },
        })
      )
    );
  }

  // ------------------------------------------------------------------
  // 2. Merge and upsert facts (only for allowed properties)
  // ------------------------------------------------------------------
  const propertyIds = [...new Set(allowedFacts.map((f) => f.propertyId))];

  const existingFacts = await prisma.accessibilityFact.findMany({
    where: { propertyId: { in: propertyIds } },
  });

  const asFacts = existingFacts.map((f) => ({
    id: f.id,
    propertyId: f.propertyId,
    fieldName: f.fieldName,
    value: f.value,
    tier: f.tier as Tier,
    sourceType: f.sourceType as SourceType,
    sourceNodeId: f.sourceNodeId,
    submittedBy: f.submittedBy,
    timestamp: f.timestamp.toISOString(),
    signatureHash: f.signatureHash,
  }));

  const merged = mergeGossipDelta(asFacts, { ...delta, facts: allowedFacts });

  await Promise.all(
    merged.map((fact) =>
      prisma.accessibilityFact.upsert({
        where: {
          propertyId_fieldName_sourceNodeId: {
            propertyId: fact.propertyId,
            fieldName: fact.fieldName,
            sourceNodeId: fact.sourceNodeId,
          },
        },
        update: { value: fact.value, tier: fact.tier, timestamp: new Date(fact.timestamp) },
        create: {
          propertyId: fact.propertyId,
          fieldName: fact.fieldName,
          value: fact.value,
          tier: fact.tier,
          sourceType: fact.sourceType ?? "AUDITOR",
          sourceNodeId: fact.sourceNodeId,
          submittedBy: fact.submittedBy,
          timestamp: new Date(fact.timestamp),
          signatureHash: fact.signatureHash,
        },
      })
    )
  );

  // Record the gossip snapshot
  const snapshotHash = createHash("sha256")
    .update(JSON.stringify(allowedFacts))
    .digest("hex");

  await prisma.gossipSnapshot.create({
    data: {
      fromNodeId: delta.fromNodeId,
      snapshotHash,
      factCount: allowedFacts.length,
    },
  });

  return NextResponse.json({
    ok: true,
    propertiesUpserted: allowedProperties.length,
    ingested: allowedFacts.length,
  });
}
