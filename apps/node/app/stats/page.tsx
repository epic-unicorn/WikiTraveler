import { prisma } from "@/lib/prisma";
import { NODE_ID, NODE_VERSION, NODE_REGION } from "@/lib/nodeInfo";
import Link from "next/link";
import { AdminPanel } from "../AdminPanel";

export const dynamic = "force-dynamic";

const TIER_COLOR: Record<string, string> = {
  OFFICIAL: "#9ca3af",
  AI_GUESS: "#fbbf24",
  VERIFIED: "#34d399",
  CONFIRMED: "#60a5fa",
};

const SOURCE_COLOR: Record<string, string> = {
  WIKIDATA: "#8b5cf6",
  WHEELMAP: "#0ea5e9",
  OSM: "#10b981",
  WHEEL_THE_WORLD: "#f97316",
  AUDITOR: "#ec4899",
};

export default async function StatsPage() {
  const [
    propertyCount,
    factCount,
    auditCount,
    peerCount,
    peers,
    tierCounts,
    sourceCounts,
    fieldCounts,
    propertiesWithFacts,
    recentAudits30d,
    recentUpdates7d,
    recentUpdates30d,
    oldestProperty,
    topAudited,
    osmSync,
    gossipHistory,
  ] = await Promise.all([
    prisma.property.count(),
    prisma.accessibilityFact.count(),
    prisma.auditSubmission.count(),
    prisma.nodePeer.count({ where: { isActive: true } }),
    prisma.nodePeer.findMany({
      orderBy: { lastSeen: "desc" },
      take: 10,
      select: { url: true, isActive: true, lastSeen: true },
    }),
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
    prisma.osmSyncState.findMany({ orderBy: { lastSync: "desc" } }),
    prisma.gossipSnapshot.findMany({
      orderBy: { appliedAt: "desc" },
      take: 5,
      select: { fromNodeId: true, appliedAt: true, factCount: true },
    }),
  ]);

  // Fetch property names for top audited
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

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      {/* Header */}
      <header style={{ background: "#1e3a5f", color: "#fff", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>🌍 WikiTraveler Node</h1>
          <p style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
            {NODE_REGION} · {NODE_ID} · v{NODE_VERSION}
          </p>
        </div>
        <Link href="/" style={{ color: "#93c5fd", fontSize: 13, textDecoration: "none" }}>← Dashboard</Link>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Statistics</h2>

        <AdminPanel />

        {/* ── Overview ── */}
        <Section title="Overview">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
            <BigStat label="Properties" value={propertyCount} />
            <BigStat label="Facts" value={factCount} />
            <BigStat label="Audits" value={auditCount} />
            <BigStat label="Active Peers" value={peerCount} />
            <BigStat label="Coverage" value={`${coveragePct}%`} sub={`${propertiesWithFacts} of ${propertyCount} have facts`} />
          </div>
        </Section>

        {/* ── Freshness ── */}
        <Section title="Freshness">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
            <BigStat label="Updated (7d)" value={recentUpdates7d} />
            <BigStat label="Updated (30d)" value={recentUpdates30d} />
            <BigStat label="Audits (30d)" value={recentAudits30d} />
            {oldestProperty && (
              <BigStat
                label="Oldest record"
                value={oldestProperty.updatedAt.toLocaleDateString()}
                sub="last updated"
              />
            )}
            {osmSync[0]?.lastSync && (
              <BigStat
                label="Last OSM ingest"
                value={osmSync[0].lastSync.toLocaleDateString()}
                sub={`${osmSync[0].itemCount ?? "?"} items`}
              />
            )}
          </div>
        </Section>

        {/* ── Tier breakdown ── */}
        <Section title="Facts by Trust Tier">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(["CONFIRMED", "VERIFIED", "AI_GUESS", "OFFICIAL"] as const).map((tier) => {
              const count = tierCounts.find((t) => t.tier === tier)?._count._all ?? 0;
              const pct = factCount > 0 ? Math.round((count / factCount) * 100) : 0;
              return (
                <div key={tier}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{tier.replace("_", " ")}</span>
                    <span style={{ color: "#6b7280" }}>{count.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div style={{ background: "#e5e7eb", borderRadius: 4, height: 8 }}>
                    <div style={{ width: `${pct}%`, background: TIER_COLOR[tier], height: 8, borderRadius: 4, transition: "width 0.3s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── Source breakdown ── */}
        <Section title="Facts by Source">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sourceCounts
              .sort((a, b) => b._count._all - a._count._all)
              .map(({ sourceType, _count }) => {
                const pct = factCount > 0 ? Math.round((_count._all / factCount) * 100) : 0;
                return (
                  <div key={sourceType}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{sourceType}</span>
                      <span style={{ color: "#6b7280" }}>{_count._all.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div style={{ background: "#e5e7eb", borderRadius: 4, height: 8 }}>
                      <div style={{ width: `${pct}%`, background: SOURCE_COLOR[sourceType] ?? "#9ca3af", height: 8, borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </Section>

        {/* ── Top fields ── */}
        <Section title="Most Audited Fields">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <Th>Field</Th>
                <Th align="right">Facts</Th>
              </tr>
            </thead>
            <tbody>
              {fieldCounts.map(({ fieldName, _count }) => (
                <tr key={fieldName} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <Td>{fieldName.replace(/_/g, " ")}</Td>
                  <Td align="right">{_count._all.toLocaleString()}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* ── Top audited properties ── */}
        <Section title="Most Audited Properties">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <Th>Property</Th>
                <Th align="right">Audit submissions</Th>
              </tr>
            </thead>
            <tbody>
              {topAuditedWithNames.map(({ name, count }) => (
                <tr key={name} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <Td>{name}</Td>
                  <Td align="right">{count}</Td>
                </tr>
              ))}
              {topAuditedWithNames.length === 0 && (
                <tr><td colSpan={2} style={{ padding: "12px 8px", color: "#9ca3af", textAlign: "center" }}>No audits yet</td></tr>
              )}
            </tbody>
          </table>
        </Section>

        {/* ── Peer network ── */}
        <Section title="Peer Network">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <Th>URL</Th>
                <Th>Status</Th>
                <Th align="right">Last seen</Th>
              </tr>
            </thead>
            <tbody>
              {peers.map((p) => (
                <tr key={p.url} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <Td><a href={p.url} style={{ color: "#1e3a5f" }}>{p.url}</a></Td>
                  <Td>
                    <span style={{ background: p.isActive ? "#dcfce7" : "#fee2e2", color: p.isActive ? "#166534" : "#991b1b", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                      {p.isActive ? "active" : "inactive"}
                    </span>
                  </Td>
                  <Td align="right">{p.lastSeen.toLocaleString()}</Td>
                </tr>
              ))}
              {peers.length === 0 && (
                <tr><td colSpan={3} style={{ padding: "12px 8px", color: "#9ca3af", textAlign: "center" }}>No peers known yet</td></tr>
              )}
            </tbody>
          </table>
        </Section>

        {/* ── Recent gossip ── */}
        {gossipHistory.length > 0 && (
          <Section title="Recent Gossip Syncs">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <Th>From node</Th>
                  <Th align="right">Facts ingested</Th>
                  <Th align="right">When</Th>
                </tr>
              </thead>
              <tbody>
                {gossipHistory.map((g, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <Td style={{ fontFamily: "monospace" }}>{g.fromNodeId}</Td>
                    <Td align="right">{g.factCount}</Td>
                    <Td align="right">{g.appliedAt.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}
      </main>
    </div>
  );
}

// ── Small shared components ──────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "20px 24px", marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#111827" }}>{title}</h3>
      {children}
    </section>
  );
}

function BigStat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div style={{ background: "#f9fafb", borderRadius: 10, padding: "14px 16px", border: "1px solid #e5e7eb" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#1e3a5f" }}>{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return <th style={{ textAlign: align ?? "left", padding: "8px 8px", fontWeight: 600, fontSize: 12, color: "#6b7280" }}>{children}</th>;
}

function Td({ children, align, style }: { children: React.ReactNode; align?: "right"; style?: React.CSSProperties }) {
  return <td style={{ padding: "8px 8px", textAlign: align ?? "left", ...style }}>{children}</td>;
}
