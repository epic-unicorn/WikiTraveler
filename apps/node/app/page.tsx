import { prisma } from "@/lib/prisma";
import { NODE_ID, NODE_VERSION } from "@/lib/nodeInfo";
import Link from "next/link";

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

const SOURCE_COLOR: Record<string, string> = {
  AMADEUS: "#6366f1",
  WHEELMAP: "#0ea5e9",
  WHEEL_THE_WORLD: "#f97316",
  AUDITOR: "#10b981",
};

const SOURCE_LABEL: Record<string, string> = {
  AMADEUS: "Amadeus",
  WHEELMAP: "Wheelmap ♿",
  WHEEL_THE_WORLD: "WtW",
  AUDITOR: "Field Audit",
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
            {NODE_ID} · v{NODE_VERSION}
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
          <div style={{ display: "grid", gap: 20 }}>
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p} />
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

function PropertyCard({
  property,
}: {
  property: {
    id: string;
    name: string;
    location: string;
    facts: Array<{ id: string; fieldName: string; value: string; tier: string; sourceType: string }>;
  };
}) {
  // Collapse to highest tier per field
  const best = new Map<string, { value: string; tier: string; sourceType: string }>();
  const tierRank: Record<string, number> = {
    OFFICIAL: 0,
    AI_GUESS: 1,
    VERIFIED: 2,
    CONFIRMED: 3,
  };
  for (const f of property.facts) {
    const existing = best.get(f.fieldName);
    if (!existing || (tierRank[f.tier] ?? 0) > (tierRank[existing.tier] ?? 0)) {
      best.set(f.fieldName, { value: f.value, tier: f.tier, sourceType: f.sourceType });
    }
  }
  const displayFacts = Array.from(best.entries());

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #f3f4f6",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>{property.name}</h2>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
            📍 {property.location}
          </p>
        </div>
        <Link
          href={`/properties/${property.id}`}
          style={{
            background: "#1e3a5f",
            color: "#fff",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Audit →
        </Link>
      </div>

      {displayFacts.length === 0 ? (
        <p style={{ padding: "16px 20px", color: "#9ca3af", fontSize: 13 }}>
          No accessibility facts yet — be the first to audit.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 1,
            background: "#f3f4f6",
          }}
        >
          {displayFacts.map(([fieldName, { value, tier, sourceType }]) => (
            <div
              key={fieldName}
              style={{ background: "#fff", padding: "12px 16px" }}
            >
              <p style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                {fieldName.replace(/_/g, " ")}
              </p>
              <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
                {value}
              </p>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <span
                  style={{
                    background: TIER_COLOR[tier] ?? "#9ca3af",
                    color: "#fff",
                    borderRadius: 999,
                    padding: "2px 8px",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {TIER_LABEL[tier] ?? tier}
                </span>
                <span
                  style={{
                    background: SOURCE_COLOR[sourceType] ?? "#9ca3af",
                    color: "#fff",
                    borderRadius: 999,
                    padding: "2px 8px",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {SOURCE_LABEL[sourceType] ?? sourceType}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
