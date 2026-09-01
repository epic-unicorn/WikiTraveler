import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AuditPage from "./AuditPage";
import { PropertyBackLink } from "./PropertyBackLink";
import { NodeAppShell } from "../../NodeAppShell";

export const dynamic = "force-dynamic";

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
  });

  if (!property) notFound();

  return (
    <NodeAppShell activeNav="map" maxWidth={960}>
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
      />
    </NodeAppShell>
  );
}
