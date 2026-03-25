import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mergeGossipDelta } from "@wikitraveler/core";
import { createHash } from "crypto";
import type { GossipDelta, Tier, SourceType } from "@wikitraveler/core";

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
  //    This ensures FK constraints are satisfied before inserting facts,
  //    which is critical for a bootstrapping node receiving its first sync.
  // ------------------------------------------------------------------
  if (Array.isArray(delta.properties) && delta.properties.length > 0) {
    await Promise.all(
      delta.properties.map((p) =>
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
  // 2. Merge and upsert facts
  // ------------------------------------------------------------------
  const propertyIds = [...new Set(delta.facts.map((f) => f.propertyId))];

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

  const merged = mergeGossipDelta(asFacts, delta);

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
    .update(JSON.stringify(delta.facts))
    .digest("hex");

  await prisma.gossipSnapshot.create({
    data: {
      fromNodeId: delta.fromNodeId,
      snapshotHash,
      factCount: delta.facts.length,
    },
  });

  return NextResponse.json({
    ok: true,
    propertiesUpserted: delta.properties?.length ?? 0,
    ingested: delta.facts.length,
  });
}
