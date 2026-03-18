import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { evaluateMeshTruth } from "@wikitraveler/core";
import { NODE_ID } from "@/lib/nodeInfo";
import type { NextRequest } from "next/server";
import type { Tier } from "@wikitraveler/core";

// GET /api/properties/:id/accessibility
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const property = await prisma.property.findUnique({
    where: { id: params.id },
  });
  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  const rawFacts = await prisma.accessibilityFact.findMany({
    where: { propertyId: params.id },
    orderBy: { timestamp: "desc" },
  });

  // Deduplicate to highest tier per fieldName using core merge logic
  const asFacts = rawFacts.map((f) => ({
    id: f.id,
    propertyId: f.propertyId,
    fieldName: f.fieldName,
    value: f.value,
    tier: f.tier as Tier,
    sourceNodeId: f.sourceNodeId,
    submittedBy: f.submittedBy,
    timestamp: f.timestamp.toISOString(),
    signatureHash: f.signatureHash,
  }));

  // Re-evaluate MESH_TRUTH before returning
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
  try {
    requireAuth(req);
  } catch {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

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

  const property = await prisma.property.findUnique({
    where: { id: params.id },
  });
  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

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
      propertyId: params.id,
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
            propertyId: params.id,
            fieldName: fact.fieldName,
            sourceNodeId: NODE_ID,
          },
        },
        update: {
          value: fact.value,
          tier: "COMMUNITY",
          timestamp: new Date(),
        },
        create: {
          propertyId: params.id,
          fieldName: fact.fieldName,
          value: fact.value,
          tier: "COMMUNITY",
          sourceNodeId: NODE_ID,
        },
      })
    )
  );

  return NextResponse.json({ message: "Audit accepted", propertyId: params.id });
}
