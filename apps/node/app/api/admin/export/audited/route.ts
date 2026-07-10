import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NODE_ID } from "@/lib/nodeInfo";
import { requireRole } from "@/lib/auth";
import { getNodeRegionLabel } from "@/lib/nodeSettings";
import type { NextRequest } from "next/server";


export { dynamic } from "@/lib/apiRoute";
/**
 * GET /api/admin/export/audited
 * JSON export of auditor-sourced facts, submissions, and related properties.
 */
export async function GET(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const region = await getNodeRegionLabel();

  const facts = await prisma.accessibilityFact.findMany({
    where: { sourceType: "AUDITOR" },
    include: {
      property: {
        select: {
          id: true,
          canonicalId: true,
          name: true,
          location: true,
          lat: true,
          lon: true,
          osmId: true,
        },
      },
    },
  });

  const propertyIds = [...new Set(facts.map((f) => f.propertyId))];
  const audits = await prisma.auditSubmission.findMany({
    where: { propertyId: { in: propertyIds } },
    include: { photos: true },
  });

  const properties = await prisma.property.findMany({
    where: { id: { in: propertyIds } },
  });

  const export_ = {
    version: 1,
    type: "audited",
    createdAt: new Date().toISOString(),
    nodeId: NODE_ID,
    region,
    properties,
    facts: facts.map(({ property: _p, ...f }) => f),
    audits,
  };

  return new NextResponse(JSON.stringify(export_, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="wikitraveler-audited-${NODE_ID}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
