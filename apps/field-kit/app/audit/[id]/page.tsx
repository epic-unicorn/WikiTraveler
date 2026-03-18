import FieldAuditForm from "./FieldAuditForm";

// Fetch property metadata server-side so the form receives it as props
export default async function AuditPage({ params }: { params: { id: string } }) {
  const nodeUrl = process.env.NEXT_PUBLIC_NODE_API_URL ?? "http://localhost:3000";

  let property: { id: string; name: string; location: string } | null = null;
  try {
    const res = await fetch(
      `${nodeUrl}/api/properties/${encodeURIComponent(params.id)}/accessibility`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json() as { property: { id: string; name: string; location: string } };
      property = data.property;
    }
  } catch {
    // node unreachable — will still render the form with fallback
  }

  return (
    <FieldAuditForm
      propertyId={params.id}
      propertyName={property?.name ?? "Unknown Property"}
      location={property?.location ?? "Unknown Location"}
    />
  );
}
