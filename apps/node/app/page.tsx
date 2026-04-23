import { prisma } from "@/lib/prisma";
import { NODE_ID, NODE_VERSION, NODE_REGION } from "@/lib/nodeInfo";
import { SearchMapLayout } from "./SearchMapLayout";
import { SignOutButton } from "./SignOutButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [propertyCount, peerCount, factCount] = await Promise.all([
    prisma.property.count(),
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
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>🌍 WikiTraveler Node</h1>
          </Link>
          <p style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
            {NODE_REGION} · {NODE_ID} · v{NODE_VERSION}
          </p>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 14, alignItems: "center" }}>
          <Stat label="Properties" value={propertyCount} />
          <Stat label="Facts" value={factCount} />
          <Stat label="Active Peers" value={peerCount} />
          <Link href="/stats" style={{ color: "#93c5fd", fontSize: 13, textDecoration: "none", marginLeft: 8 }}>Stats →</Link>
          <SignOutButton />
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px" }}>
        <SearchMapLayout propertyCount={propertyCount} />
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


