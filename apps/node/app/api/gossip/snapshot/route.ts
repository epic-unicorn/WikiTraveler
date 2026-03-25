import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NODE_ID } from "@/lib/nodeInfo";
import type { NextRequest } from "next/server";

// GET /api/gossip/snapshot?since=<ISO>
export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get("since");
  const sinceDate = since ? new Date(since) : new Date(0);

  const facts = await prisma.accessibilityFact.findMany({
    where: {
      timestamp: { gt: sinceDate },
    },
    orderBy: { timestamp: "asc" },
  });

  // Include all properties referenced by the facts so new nodes can upsert
  // them before inserting facts (avoids FK violations).
  const propertyIds = [...new Set(facts.map((f) => f.propertyId))];
  const properties = propertyIds.length > 0
    ? await prisma.property.findMany({
        where: { id: { in: propertyIds } },
        select: { id: true, canonicalId: true, name: true, location: true, osmId: true, wheelmapId: true },
      })
    : [];

  return NextResponse.json({
    fromNodeId: NODE_ID,
    since: sinceDate.toISOString(),
    until: new Date().toISOString(),
    properties,
    facts: facts.map((f) => ({
      id: f.id,
      propertyId: f.propertyId,
      fieldName: f.fieldName,
      value: f.value,
      tier: f.tier,
      sourceType: f.sourceType,
      sourceNodeId: f.sourceNodeId,
      submittedBy: f.submittedBy,
      timestamp: f.timestamp.toISOString(),
      signatureHash: f.signatureHash,
    })),
  });
}
