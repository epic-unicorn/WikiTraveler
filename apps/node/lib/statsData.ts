import { prisma } from "@/lib/prisma";
import { getNodeSettings } from "@/lib/nodeSettings";

export interface StatsPageData {
  propertyCount: number;
  factCount: number;
  auditCount: number;
  peerCount: number;
  tierCounts: { tier: string; count: number }[];
  sourceCounts: { sourceType: string; count: number }[];
  fieldCounts: { fieldName: string; count: number }[];
  propertiesWithFacts: number;
  recentAudits30d: number;
  recentUpdates7d: number;
  recentUpdates30d: number;
  oldestPropertyUpdatedAt: string | null;
  osmLastSync: string | null;
  osmItemCount: number | null;
  topAuditedWithNames: { name: string; count: number }[];
  gossipHistory: { fromNodeId: string; factCount: number; appliedAt: string }[];
  coveragePct: number;
}

export async function loadStatsData(): Promise<StatsPageData> {
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

  return {
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
}
