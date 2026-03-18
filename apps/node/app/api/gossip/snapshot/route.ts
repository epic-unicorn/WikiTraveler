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

  return NextResponse.json({
    fromNodeId: NODE_ID,
    since: sinceDate.toISOString(),
    until: new Date().toISOString(),
    facts: facts.map((f) => ({
      id: f.id,
      propertyId: f.propertyId,
      fieldName: f.fieldName,
      value: f.value,
      tier: f.tier,
      sourceNodeId: f.sourceNodeId,
      submittedBy: f.submittedBy,
      timestamp: f.timestamp.toISOString(),
      signatureHash: f.signatureHash,
    })),
  });
}
