import { prisma } from "@/lib/prisma";
import { NODE_ID, NODE_VERSION, NODE_REGION } from "@/lib/nodeInfo";
import { PropertyRow } from "./PropertyRow";

export const dynamic = "force-dynamic";

const TIER_COLOR: Record<string, string> = {
  OFFICIAL: "#9ca3af",
  AI_GUESS: "#fbbf24",
  VERIFIED: "#34d399",
  CONFIRMED: "#60a5fa",
};

const TIER_LABEL: Record<string, string> = {
  OFFICIAL: "Official",
  AI_GUESS: "AI Estimate",
  VERIFIED: "Verified",
  CONFIRMED: "Confirmed",
};

export default async function DashboardPage() {
  const [properties, peerCount, factCount] = await Promise.all([
    prisma.property.findMany({
      include: { facts: { orderBy: { timestamp: "desc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.nodePeer.count({ where: { isActive: true } }),
    prisma.accessibilityFact.count(),
  ]);

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      {/* Header */}
      <header
        style={{
          background: "#1e3a5f",
          color: "#fff",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>🌍 WikiTraveler Node</h1>
          <p style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
            {NODE_REGION} · {NODE_ID} · v{NODE_VERSION}
          </p>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 14 }}>
          <Stat label="Properties" value={properties.length} />
          <Stat label="Facts" value={factCount} />
          <Stat label="Active Peers" value={peerCount} />
        </div>
      </header>

      <main className="container" style={{ padding: "32px 20px" }}>
        {/* Tier legend */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 32,
          }}
        >
          {Object.entries(TIER_LABEL).map(([tier, label]) => (
            <span
              key={tier}
              style={{
                background: TIER_COLOR[tier],
                color: "#fff",
                borderRadius: 999,
                padding: "4px 14px",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {label}
            </span>
          ))}
        </div>

        {properties.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {properties.map((p) => (
              <PropertyRow key={p.id} property={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 20px",
        color: "#6b7280",
      }}
    >
      <p style={{ fontSize: 48, marginBottom: 16 }}>🏨</p>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>No properties yet</h2>
      <p style={{ fontSize: 14 }}>
        Run <code style={{ background: "#e5e7eb", padding: "2px 6px", borderRadius: 4 }}>pnpm db:seed</code> to load
        sample properties from Amadeus, or submit your first community audit.
      </p>
    </div>
  );
}


