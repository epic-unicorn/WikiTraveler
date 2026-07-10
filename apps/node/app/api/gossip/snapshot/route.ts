import { NextResponse } from "next/server";
import { GOSSIP_PROTOCOL_VERSION } from "@wikitraveler/core";
import { prisma } from "@/lib/prisma";
import { NODE_ID } from "@/lib/nodeInfo";
import { getNodeBbox, getNodeRegionLabel } from "@/lib/nodeSettings";
import { requireNodeAuth } from "@/lib/auth";
import { loadOverridesChangedSince } from "@/lib/propertyMetadata";
import type { NextRequest } from "next/server";


export { dynamic } from "@/lib/apiRoute";
// GET /api/gossip/snapshot?since=<ISO>
export async function GET(req: NextRequest) {
  const authError = await requireNodeAuth(req);
  if (authError) return authError;
  const since = req.nextUrl.searchParams.get("since");
  const sinceDate = since ? new Date(since) : new Date(0);

  const facts = await prisma.accessibilityFact.findMany({
    where: {
      timestamp: { gt: sinceDate },
    },
    orderBy: { timestamp: "asc" },
  });

  const metadataOverrides = await loadOverridesChangedSince(sinceDate);

  // Include properties referenced by facts or metadata overrides.
  const propertyIds = [
    ...new Set([
      ...facts.map((f) => f.propertyId),
      ...(metadataOverrides.length > 0
        ? (
            await prisma.property.findMany({
              where: { canonicalId: { in: [...new Set(metadataOverrides.map((o) => o.canonicalId))] } },
              select: { id: true },
            })
          ).map((p) => p.id)
        : []),
    ]),
  ];
  const properties = propertyIds.length > 0
    ? await prisma.property.findMany({
        where: { id: { in: propertyIds } },
        select: { id: true, canonicalId: true, name: true, location: true, lat: true, lon: true, osmId: true, wheelmapId: true },
      })
    : [];

  // Include active peers so recipients can discover the network organically
  const [selfBbox, selfRegion, peerRows] = await Promise.all([
    getNodeBbox(),
    getNodeRegionLabel(),
    prisma.nodePeer.findMany({
      where: { isActive: true },
      select: { url: true, nodeId: true, region: true, bbox: true },
    }),
  ]);
  const peers = peerRows.map((p) => ({
    nodeId: p.nodeId ?? NODE_ID,
    url: p.url,
    region: p.region ?? selfRegion ?? null,
    bbox: p.bbox ?? selfBbox ?? null,
  }));

  // Photo URL references for federated display (v2 gossip — no binary sync)
  const latestAudits = propertyIds.length > 0
    ? await prisma.auditSubmission.findMany({
        where: {
          propertyId: { in: propertyIds },
          OR: [
            { NOT: { photoUrls: { equals: [] } } },
            { photos: { some: {} } },
          ],
        },
        orderBy: { createdAt: "desc" },
        distinct: ["propertyId"],
        select: {
          propertyId: true,
          photoUrls: true,
          photos: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 3 },
        },
      })
    : [];

  const photoRefs = Object.fromEntries(
    latestAudits.map((a) => {
      const urls = a.photos.length > 0
        ? a.photos.map((p) => p.url)
        : (a.photoUrls as string[]);
      return [a.propertyId, { originNode: NODE_ID, urls: urls.slice(0, 3) }];
    })
  );

  return NextResponse.json({
    fromNodeId: NODE_ID,
    protocolVersion: GOSSIP_PROTOCOL_VERSION,
    since: sinceDate.toISOString(),
    until: new Date().toISOString(),
    properties,
    facts: facts.map((f) => ({
      id: f.id,
      propertyId: f.propertyId,
      fieldName: f.fieldName,
      scopeKey: f.scopeKey,
      value: f.value,
      tier: f.tier,
      sourceType: f.sourceType,
      sourceNodeId: f.sourceNodeId,
      submittedBy: f.submittedBy,
      timestamp: f.timestamp.toISOString(),
      signatureHash: f.signatureHash,
    })),
    peers,
    photoRefs,
    metadataOverrides,
  });
}
