import { cookies } from "next/headers";
import type { Metadata } from "next";
import FieldAuditForm from "./FieldAuditForm";
import { decodeAuthCookie, readNodeUrlCookie } from "../../lib/authStorage";

const ENV_NODE_URL = process.env.NEXT_PUBLIC_NODE_API_URL ?? "http://localhost:3000";

async function resolveTargetNodeUrl(searchParams: { node?: string }) {
  const cookieStore = await cookies();
  const configuredNodeUrl =
    readNodeUrlCookie(cookieStore.get("wt_node_url")?.value) ?? ENV_NODE_URL;
  return searchParams.node ?? configuredNodeUrl;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ node?: string }>;
}): Promise<Metadata> {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const targetNodeUrl = await resolveTargetNodeUrl(resolvedSearchParams);
  let name = "Property";
  try {
    const res = await fetch(
      `${targetNodeUrl}/api/properties/${encodeURIComponent(id)}/accessibility`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json() as { property?: { name?: string } };
      name = data.property?.name ?? name;
    }
  } catch {
    // node unreachable — fall back to generic title
  }
  return { title: `${name} — WikiTraveler Access` };
}

// Fetch property metadata server-side so the form receives it as props
export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ node?: string }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const targetNodeUrl = await resolveTargetNodeUrl(resolvedSearchParams);

  // Pass the auth cookie so the authenticated API endpoint accepts the request
  const cookieStore = await cookies();
  const rawToken = cookieStore.get("wt_token")?.value;
  const token = decodeAuthCookie(rawToken);
  const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  let property: { id: string; name: string; location: string } | null = null;
  let existingFacts: Array<{
    fieldName: string;
    value: string;
    tier: string;
    signatureHash?: string | null;
    timestamp?: string;
  }> = [];

  try {
    const res = await fetch(
      `${targetNodeUrl}/api/properties/${encodeURIComponent(id)}/accessibility`,
      { cache: "no-store", headers: authHeaders }
    );
    if (res.ok) {
      const data = await res.json() as {
        property: { id: string; name: string; location: string };
        facts: Array<{
          fieldName: string;
          value: string;
          tier: string;
          signatureHash?: string | null;
          timestamp?: string;
        }>;
      };
      property = data.property;
      existingFacts = data.facts ?? [];
    }
  } catch {
    // node unreachable — will still render the form with fallback
  }

  return (
    <FieldAuditForm
      propertyId={id}
      propertyName={property?.name ?? "Unknown Property"}
      location={property?.location ?? "Unknown Location"}
      existingFacts={existingFacts}
      targetNodeUrl={resolvedSearchParams.node}
    />
  );
}
