import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { setAuditedReimportPending } from "@/lib/nodeSettings";
import type { NextRequest } from "next/server";


export const dynamic = "force-dynamic";
interface AuditedImport {
  version?: number;
  type?: string;
  properties?: Array<{
    id: string;
    canonicalId: string;
    name: string;
    location: string;
    lat?: number | null;
    lon?: number | null;
    osmId?: string | null;
  }>;
  facts?: Array<{
    propertyId: string;
    fieldName: string;
    scopeKey?: string;
    value: string;
    tier: string;
    sourceType: string;
    sourceNodeId: string;
    submittedBy?: string | null;
    signatureHash?: string | null;
    timestamp?: string;
  }>;
  audits?: Array<{
    id: string;
    propertyId: string;
    auditorToken?: string | null;
    locale?: string | null;
    facts: unknown;
    photoUrls?: unknown;
    photos?: Array<{
      url: string;
      caption?: string | null;
      fieldName?: string | null;
      scopeKey?: string | null;
      width?: number | null;
      height?: number | null;
      sortOrder?: number;
    }>;
    createdAt?: string;
  }>;
}

/**
 * POST /api/admin/import/audited
 * Re-attach auditor data after region change (match by osmId / canonicalId).
 */
export async function POST(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  let data: AuditedImport;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(data.facts)) {
    return NextResponse.json({ message: "facts[] required" }, { status: 400 });
  }

  const exportedProps = data.properties ?? [];
  const idMap = new Map<string, string>();
  let matched = 0;
  let skipped = 0;
  let factsImported = 0;

  for (const ep of exportedProps) {
    let existing = null;
    if (ep.osmId) {
      existing = await prisma.property.findUnique({ where: { osmId: ep.osmId } });
    }
    if (!existing && ep.canonicalId) {
      existing = await prisma.property.findUnique({ where: { canonicalId: ep.canonicalId } });
    }
    if (existing) {
      idMap.set(ep.id, existing.id);
      matched++;
    } else {
      skipped++;
    }
  }

  for (const fact of data.facts) {
    if (fact.sourceType !== "AUDITOR") continue;
    const newPropertyId = idMap.get(fact.propertyId);
    if (!newPropertyId) continue;

    await prisma.accessibilityFact.upsert({
      where: {
        propertyId_fieldName_sourceNodeId_scopeKey: {
          propertyId: newPropertyId,
          fieldName: fact.fieldName,
          sourceNodeId: fact.sourceNodeId,
          scopeKey: fact.scopeKey ?? "property",
        },
      },
      update: {
        value: fact.value,
        tier: fact.tier as never,
        submittedBy: fact.submittedBy,
        signatureHash: fact.signatureHash,
      },
      create: {
        propertyId: newPropertyId,
        fieldName: fact.fieldName,
        scopeKey: fact.scopeKey ?? "property",
        value: fact.value,
        tier: fact.tier as never,
        sourceType: "AUDITOR",
        sourceNodeId: fact.sourceNodeId,
        submittedBy: fact.submittedBy,
        signatureHash: fact.signatureHash,
        timestamp: fact.timestamp ? new Date(fact.timestamp) : new Date(),
      },
    });
    factsImported++;
  }

  await setAuditedReimportPending(false);

  return NextResponse.json({
    ok: true,
    matched,
    skipped,
    factsImported,
    message: `Matched ${matched} properties, imported ${factsImported} auditor facts. ${skipped} properties had no match in the new region.`,
  });
}
