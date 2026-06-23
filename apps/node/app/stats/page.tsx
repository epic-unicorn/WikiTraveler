import { prisma } from "@/lib/prisma";
import { NODE_ID, NODE_VERSION } from "@/lib/nodeInfo";
import { getNodeRegionLabel, getNodeSettings } from "@/lib/nodeSettings";
import { NodeAppShell } from "../NodeAppShell";
import { StatsPageContent, type StatsPageData } from "./StatsPageContent";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const [
    propertyCount,
    factCount,
    auditCount,
    peerCount,
    tierCounts,
    sourceCounts,
    fieldCounts,
    propertiesWithFacts,
    recentAudits30d,
    recentUpdates7d,
    recentUpdates30d,
    oldestProperty,
    topAudited,
    nodeSettings,
    gossipHistory,
    region,
  ] = await Promise.all([
    prisma.property.count(),
    prisma.accessibilityFact.count(),
    prisma.auditSubmission.count(),
    prisma.nodePeer.count({ where: { isActive: true } }),
    prisma.accessibilityFact.groupBy({ by: ["tier"], _count: { _all: true } }),
    prisma.accessibilityFact.groupBy({ by: ["sourceType"], _count: { _all: true } }),
    prisma.accessibilityFact.groupBy({
      by: ["fieldName"],
      _count: { _all: true },
      orderBy: { _count: { fieldName: "desc" } },
      take: 10,
    }),
    prisma.property.count({ where: { facts: { some: {} } } }),
    prisma.auditSubmission.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
    }),
    prisma.property.count({
      where: { updatedAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
    }),
    prisma.property.count({
      where: { updatedAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
    }),
    prisma.property.findFirst({ orderBy: { updatedAt: "asc" }, select: { updatedAt: true } }),
    prisma.auditSubmission.groupBy({
      by: ["propertyId"],
      _count: { _all: true },
      orderBy: { _count: { propertyId: "desc" } },
      take: 10,
    }),
    getNodeSettings(),
    prisma.gossipSnapshot.findMany({
      orderBy: { appliedAt: "desc" },
      take: 5,
      select: { fromNodeId: true, appliedAt: true, factCount: true },
    }),
    getNodeRegionLabel(),
  ]);

  const topAuditedWithNames = await Promise.all(
    topAudited.map(async (a) => {
      const prop = await prisma.property.findUnique({
        where: { id: a.propertyId },
        select: { name: true },
      });
      return { name: prop?.name ?? a.propertyId, count: a._count._all };
    })
  );

  const coveragePct = propertyCount > 0 ? Math.round((propertiesWithFacts / propertyCount) * 100) : 0;

  const data: StatsPageData = {
    propertyCount,
    factCount,
    auditCount,
    peerCount,
    tierCounts: tierCounts.map((row) => ({ tier: row.tier, count: row._count._all })),
    sourceCounts: sourceCounts.map((row) => ({ sourceType: row.sourceType, count: row._count._all })),
    fieldCounts: fieldCounts.map((row) => ({ fieldName: row.fieldName, count: row._count._all })),
    propertiesWithFacts,
    recentAudits30d,
    recentUpdates7d,
    recentUpdates30d,
    oldestPropertyUpdatedAt: oldestProperty?.updatedAt.toISOString() ?? null,
    osmLastSync: nodeSettings.lastIngestAt,
    osmItemCount: nodeSettings.lastIngestCount,
    topAuditedWithNames,
    gossipHistory: gossipHistory.map((g) => ({
      fromNodeId: g.fromNodeId,
      factCount: g.factCount,
      appliedAt: g.appliedAt.toISOString(),
    })),
    coveragePct,
  };

  return (
    <NodeAppShell lead={`${region} · ${NODE_ID} · v${NODE_VERSION}`} activeNav="stats">
      <StatsPageContent data={data} />
    </NodeAppShell>
  );
}
