import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AuditPage from "./AuditPage";
import { PropertyBackLink } from "./PropertyBackLink";
import { NodeAppShell } from "../../NodeAppShell";

export const dynamic = "force-dynamic";

const TIER_RANK: Record<string, number> = {
  OFFICIAL: 0,
  AI_GUESS: 1,
  VERIFIED: 2,
  CONFIRMED: 3,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const property = await prisma.property.findFirst({
    where: {
      OR: [
        { id },
        { canonicalId: id },
        { osmId: id },
      ],
    },
    select: { name: true },
  });
  return {
    title: property ? `${property.name} — WikiTraveler` : "Property — WikiTraveler",
  };
}

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await prisma.property.findFirst({
    where: {
      OR: [
        { id },
        { canonicalId: id },
        { osmId: id },
      ],
    },
    include: { facts: { orderBy: { timestamp: "desc" } } },
  });

  if (!property) notFound();

  const best = new Map<
    string,
    {
      fieldName: string;
      value: string;
      tier: string;
      sourceType: string;
      submittedBy: string | null;
      timestamp: string;
    }
  >();
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
    <NodeAppShell activeNav="map" maxWidth={760}>
      <div style={{ marginBottom: 20 }}>
        <PropertyBackLink />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--wt-text)", marginTop: 4 }}>
          {property.name}
        </h1>
        <p style={{ fontSize: 14, color: "var(--wt-text-muted)", marginTop: 4 }}>{property.location}</p>
      </div>
      <AuditPage
        propertyId={property.id}
        propertyName={property.name}
        initialFacts={Array.from(best.values())}
      />
    </NodeAppShell>
  );
}
