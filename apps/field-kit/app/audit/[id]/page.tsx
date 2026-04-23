import { cookies } from "next/headers";
import FieldAuditForm from "./FieldAuditForm";

// Fetch property metadata server-side so the form receives it as props
export default async function AuditPage({ params, searchParams }: { params: { id: string }; searchParams: { node?: string } }) {
  const homeNodeUrl = process.env.NEXT_PUBLIC_NODE_API_URL ?? "http://localhost:3000";
  // If the property lives on a peer node (passed via ?node=), fetch from there.
  const targetNodeUrl = searchParams.node ?? homeNodeUrl;

  // Pass the auth cookie so the authenticated API endpoint accepts the request
  const cookieStore = cookies();
  const rawToken = cookieStore.get("wt_token")?.value;
  const token = rawToken ? decodeURIComponent(rawToken) : null;
  const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  let property: { id: string; name: string; location: string } | null = null;
  let existingFacts: Array<{ fieldName: string; value: string; tier: string }> = [];

  try {
    const res = await fetch(
      `${targetNodeUrl}/api/properties/${encodeURIComponent(params.id)}/accessibility`,
      { cache: "no-store", headers: authHeaders }
    );
    if (res.ok) {
      const data = await res.json() as {
        property: { id: string; name: string; location: string };
        facts: Array<{ fieldName: string; value: string; tier: string }>;
      };
      property = data.property;
      existingFacts = data.facts ?? [];
    }
  } catch {
    // node unreachable — will still render the form with fallback
  }

  return (
    <FieldAuditForm
      propertyId={params.id}
      propertyName={property?.name ?? "Unknown Property"}
      location={property?.location ?? "Unknown Location"}
      existingFacts={existingFacts}
      targetNodeUrl={targetNodeUrl !== homeNodeUrl ? targetNodeUrl : undefined}
    />
  );
}
