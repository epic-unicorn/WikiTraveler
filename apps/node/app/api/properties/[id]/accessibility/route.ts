import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { evaluateMeshTruth } from "@wikitraveler/core";
import { NODE_ID } from "@/lib/nodeInfo";
import { runAiAnalysis } from "@/lib/aiAnalyze";
import { pushFactsToPeers } from "@/lib/push";
import type { NextRequest } from "next/server";
import type { Tier, SourceType } from "@wikitraveler/core";

// GET /api/properties/:id/accessibility
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Find by id OR canonicalId
  const property = await prisma.property.findFirst({
    where: {
      OR: [
        { id: params.id },
        { canonicalId: params.id },
      ],
    },
  });
  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  const rawFacts = await prisma.accessibilityFact.findMany({
    where: { propertyId: property.id },
    orderBy: { timestamp: "desc" },
  });

  // Deduplicate to highest tier per fieldName using core merge logic
  const asFacts = rawFacts.map((f) => ({
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

  // Re-evaluate CONFIRMED before returning
  const evaluated = evaluateMeshTruth(asFacts);

  // Collapse to one fact per fieldName (highest tier wins)
  const collapsed = new Map<string, (typeof evaluated)[0]>();
  for (const fact of evaluated) {
    const existing = collapsed.get(fact.fieldName);
    if (
      !existing ||
      fact.tier > existing.tier ||
      (fact.tier === existing.tier &&
        fact.timestamp > existing.timestamp)
    ) {
      collapsed.set(fact.fieldName, fact);
    }
  }

  return NextResponse.json({
    propertyId: params.id,
    property,
    facts: Array.from(collapsed.values()),
  });
}

// POST /api/properties/:id/accessibility
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    facts?: Array<{ fieldName: string; value: string }>;
    photoUrls?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (!body.facts || !Array.isArray(body.facts) || body.facts.length === 0) {
    return NextResponse.json({ message: "facts array is required" }, { status: 400 });
  }

  // Find by id OR canonicalId
  const property = await prisma.property.findFirst({
    where: {
      OR: [
        { id: params.id },
        { canonicalId: params.id },
      ],
    },
  });
  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  // Use the actual property.id for database operations
  const propertyId = property.id;

  // Validate fact fields
  for (const fact of body.facts) {
    if (
      typeof fact.fieldName !== "string" ||
      typeof fact.value !== "string" ||
      fact.fieldName.trim() === "" ||
      fact.value.trim() === ""
    ) {
      return NextResponse.json(
        { message: "Each fact must have non-empty fieldName and value strings" },
        { status: 400 }
      );
    }
  }

  // Store audit submission
  await prisma.auditSubmission.create({
    data: {
      propertyId: propertyId,
      facts: body.facts,
      photoUrls: body.photoUrls ?? [],
    },
  });

  // Upsert individual accessibility facts
  await Promise.all(
    body.facts.map((fact) =>
      prisma.accessibilityFact.upsert({
        where: {
          propertyId_fieldName_sourceNodeId: {
            propertyId: propertyId,
            fieldName: fact.fieldName,
            sourceNodeId: NODE_ID,
          },
        },
        update: {
          value: fact.value,
          tier: "VERIFIED",
          timestamp: new Date(),
        },
        create: {
          propertyId: propertyId,
          fieldName: fact.fieldName,
          value: fact.value,
          tier: "VERIFIED",
          sourceType: "AUDITOR",
          sourceNodeId: NODE_ID,
        },
      })
    )
  );

  // Fire-and-forget vision analysis when photos were uploaded.
  // We do not await — the response is already on its way to the client.
  // On Vercel serverless the function may terminate before this completes;
  // the /api/cron/ai-scan job will cover any missed analyses.
  if (process.env.OPENAI_API_KEY && (body.photoUrls?.length ?? 0) > 0) {
    void runAiAnalysis({
      propertyId: propertyId,
      propertyName: property.name,
      location: property.location,
      photos: body.photoUrls!,
      skipExistingAiGuess: false, // refresh vision when new photos arrive
    }).catch((err) =>
      console.error("[accessibility] background vision analysis failed:", err)
    );
  }

  // ActivityPub-style real-time push to active peers (fire-and-forget).
  // The gossip cron remains the safety net if any peer misses this push.
  void pushFactsToPeers(
    [
      {
        id: property.id,
        canonicalId: property.canonicalId,
        name: property.name,
        location: property.location,
        osmId: property.osmId,
        wheelmapId: property.wheelmapId,
      },
    ],
    body.facts.map((fact) => ({
      id: `${NODE_ID}-${propertyId}-${fact.fieldName}`,
      propertyId: propertyId,
      fieldName: fact.fieldName,
      value: fact.value,
      tier: "VERIFIED" as Tier,
      sourceType: "AUDITOR" as SourceType,
      sourceNodeId: NODE_ID,
      submittedBy: null,
      timestamp: new Date().toISOString(),
      signatureHash: null,
    }))
  ).catch((err) =>
    console.error("[accessibility] peer push failed:", err)
  );

  return NextResponse.json({ message: "Audit accepted", propertyId: params.id });
}
