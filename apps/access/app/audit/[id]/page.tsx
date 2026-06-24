import { cookies } from "next/headers";
import type { Metadata } from "next";
import FieldAuditForm from "./FieldAuditForm";
import { decodeAuthCookie, readNodeUrlCookie } from "../../lib/authStorage";

const ENV_NODE_URL = process.env.NEXT_PUBLIC_NODE_API_URL ?? "http://localhost:3000";

function resolveTargetNodeUrl(searchParams: { node?: string }) {
  const cookieStore = cookies();
  const configuredNodeUrl =
    readNodeUrlCookie(cookieStore.get("wt_node_url")?.value) ?? ENV_NODE_URL;
  return searchParams.node ?? configuredNodeUrl;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { node?: string };
}): Promise<Metadata> {
  const targetNodeUrl = resolveTargetNodeUrl(searchParams);
  let name = "Property";
  try {
    const res = await fetch(
      `${targetNodeUrl}/api/properties/${encodeURIComponent(params.id)}/accessibility`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json() as { property?: { name?: string } };
      name = data.property?.name ?? name;
    }
  } catch {
    // node unreachable — fall back to generic title
  }
  return { title: `${name} — WikiTraveler Field Kit` };
}

// Fetch property metadata server-side so the form receives it as props
export default async function AuditPage({ params, searchParams }: { params: { id: string }; searchParams: { node?: string } }) {
  const targetNodeUrl = resolveTargetNodeUrl(searchParams);

  // Pass the auth cookie so the authenticated API endpoint accepts the request
  const cookieStore = cookies();
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
  let auditPhotos: {
    submissionId: string;
    capturedAt: string;
    photos: string[];
  } | null = null;
  let hasAiGuess = false;

  try {
    const res = await fetch(
      `${targetNodeUrl}/api/properties/${encodeURIComponent(params.id)}/accessibility`,
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
        auditPhotos: {
          submissionId: string;
          capturedAt: string;
          photos: string[];
        } | null;
        hasAiGuess?: boolean;
      };
      property = data.property;
      existingFacts = data.facts ?? [];
      auditPhotos = data.auditPhotos ?? null;
      hasAiGuess = data.hasAiGuess ?? existingFacts.some((f) => f.tier === "AI_GUESS");
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
      auditPhotos={auditPhotos}
      hasAiGuess={hasAiGuess}
      targetNodeUrl={searchParams.node}
    />
  );
}
