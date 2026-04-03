import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AuditPage from "./AuditPage";
import Link from "next/link";
import type { Tier } from "@wikitraveler/core";

export const dynamic = "force-dynamic";

const TIER_RANK: Record<string, number> = {
  OFFICIAL: 0,
  AI_GUESS: 1,
  VERIFIED: 2,
  CONFIRMED: 3,
};

export default async function PropertyPage({
  params,
}: {
  params: { id: string };
}) {
  const property = await prisma.property.findFirst({
    where: {
      OR: [
        { id: params.id },
        { canonicalId: params.id },
        { osmId: params.id },
      ],
    },
    include: { facts: { orderBy: { timestamp: "desc" } } },
  });

  if (!property) notFound();

  // Collapse to highest tier per field for SSR initial state
  const best = new Map<string, { fieldName: string; value: string; tier: string; sourceType: string; submittedBy: string | null; timestamp: string }>();
  for (const f of property.facts) {
    const existing = best.get(f.fieldName);
    if (!existing || (TIER_RANK[f.tier] ?? 0) > (TIER_RANK[existing.tier] ?? 0)) {
      best.set(f.fieldName, {
        fieldName: f.fieldName,
        value: f.value,
        tier: f.tier as string,
        sourceType: f.sourceType as string,
        submittedBy: f.submittedBy,
        timestamp: f.timestamp.toISOString(),
      });
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <header style={{ background: "#1e3a5f", color: "#fff", padding: "14px 24px" }}>
        <Link href="/" style={{ color: "#93c5fd", fontSize: 14 }}>← Dashboard</Link>
        <h1 style={{ fontSize: 20, marginTop: 4 }}>{property.name}</h1>
      </header>
      <AuditPage
        propertyId={property.id}
        propertyName={property.name}
        initialFacts={Array.from(best.values())}
      />
    </div>
  );
}
