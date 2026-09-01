import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, getAuthUser, auditorId } from "@/lib/auth";
import { evaluateMeshTruth, factKey } from "@wikitraveler/core";
import { NODE_ID, NODE_URL } from "@/lib/nodeInfo";
import { runAiAnalysis } from "@/lib/aiAnalyze";
import { pushFactsToPeers } from "@/lib/push";
import { getPhotoStorage, photoToDisplayUrl } from "@/lib/photoStorage";
import {
  extractAuditNotes,
  mergeAuditPhotosBySlot,
  type EvidencePhoto,
  type EvidenceSubmission,
} from "@/lib/auditEvidence";
import { validateAuditFacts, getFieldRegistryMap, factValuesMatch } from "@/lib/fieldRegistry";
import { enrichAuditNotesForDisplay, enrichFactsForDisplay } from "@/lib/enrichFactsForDisplay";
import { buildPropertyDetail, buildConfidenceSummary } from "@/lib/propertyEnrichment";
import { loadOverridesForCanonicalIds, resolveOne } from "@/lib/propertyMetadata";
import { invalidateFactTranslations } from "@/lib/translation";
import { resolveLocale, isSupportedLocale } from "@wikitraveler/i18n";
import { MAX_AUDIT_PHOTOS, AI_VISION_PHOTO_BUDGET } from "@wikitraveler/i18n";
import type { NextRequest } from "next/server";
import type { Tier, SourceType } from "@wikitraveler/core";


export const dynamic = "force-dynamic";
type FactInput = { fieldName: string; value: string; scopeKey?: string; confirm?: boolean };

type PhotoInput = {
  dataUri?: string;
  url?: string;
  caption?: string;
  fieldName?: string;
  scopeKey?: string;
  width?: number;
  height?: number;
};

function normalizeLegacyPhotos(photoUrls: unknown): string[] {
  if (!Array.isArray(photoUrls)) return [];
  return photoUrls
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .slice(0, MAX_AUDIT_PHOTOS)
    .map(photoToDisplayUrl);
}

function photoOriginNode(url: string): string | null {
  if (url.startsWith("data:")) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// GET /api/properties/:id/accessibility
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { id } = await params;

  const property = await prisma.property.findFirst({
    where: {
      OR: [{ id }, { canonicalId: id }],
    },
  });
  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  const rawFacts = await prisma.accessibilityFact.findMany({
    where: { propertyId: property.id },
    orderBy: { timestamp: "desc" },
  });

  const asFacts = rawFacts.map((f) => ({
    id: f.id,
    propertyId: f.propertyId,
    fieldName: f.fieldName,
    scopeKey: f.scopeKey,
    value: f.value,
    valueLocale: f.valueLocale,
    tier: f.tier as Tier,
    sourceType: f.sourceType as SourceType,
    sourceNodeId: f.sourceNodeId,
    submittedBy: f.submittedBy,
    timestamp: f.timestamp.toISOString(),
    signatureHash: f.signatureHash,
  }));

  const evaluated = evaluateMeshTruth(asFacts);

  const collapsed = new Map<string, (typeof evaluated)[0]>();
  for (const fact of evaluated) {
    const key = factKey(fact);
    const existing = collapsed.get(key);
    if (
      !existing ||
      fact.tier > existing.tier ||
      (fact.tier === existing.tier && fact.timestamp > existing.timestamp)
    ) {
      collapsed.set(key, fact);
    }
  }

  const collapsedFacts = Array.from(collapsed.values());
  const hasAiGuess = collapsedFacts.some((f) => f.tier === "AI_GUESS");

  const localeParam = req.nextUrl.searchParams.get("locale");
  const viewerLocale = localeParam && isSupportedLocale(localeParam)
    ? localeParam
    : resolveLocale({ acceptLanguage: req.headers.get("accept-language") });

  const enrichedFacts = await enrichFactsForDisplay(collapsedFacts, viewerLocale);

  const submissionsRaw = await prisma.auditSubmission.findMany({
    where: { propertyId: property.id },
    orderBy: { createdAt: "desc" },
    include: {
      photos: { orderBy: { sortOrder: "asc" } },
    },
  });

  const evidenceSubs: EvidenceSubmission[] = submissionsRaw.map((sub) => {
    const structured: EvidencePhoto[] = sub.photos.map((p) => ({
      id: p.id,
      url: photoToDisplayUrl(p.url),
      caption: p.caption,
      fieldName: p.fieldName,
      scopeKey: p.scopeKey,
      width: p.width,
      height: p.height,
    }));
    const legacy: EvidencePhoto[] = structured.length
      ? []
      : normalizeLegacyPhotos(sub.photoUrls).map((url, i) => ({
          id: `legacy-${sub.id}-${i}`,
          url,
          caption: null,
          fieldName: null,
          scopeKey: null,
          width: null,
          height: null,
        }));
    return {
      id: sub.id,
      createdAt: sub.createdAt,
      auditorToken: sub.auditorToken,
      locale: sub.locale,
      facts: sub.facts,
      photos: structured.length > 0 ? structured : legacy,
    };
  });

  const mergedPhotos = mergeAuditPhotosBySlot(evidenceSubs);
  const notesFact = enrichedFacts.find((f) => f.fieldName === "notes");
  const auditNotes = await enrichAuditNotesForDisplay(
    extractAuditNotes(evidenceSubs),
    viewerLocale,
    notesFact?.valueLocale ?? null
  );

  let auditPhotos: {
    submissionId: string;
    capturedAt: string;
    photos: Array<{
      id: string;
      url: string;
      caption: string | null;
      fieldName: string | null;
      scopeKey: string | null;
      width: number | null;
      height: number | null;
      submissionId?: string;
    }>;
    photoOriginNode: string | null;
  } | null = null;

  if (mergedPhotos.live.length > 0 && mergedPhotos.newestSubmissionId && mergedPhotos.newestCapturedAt) {
    const firstUrl = mergedPhotos.live[0]?.url ?? null;
    auditPhotos = {
      submissionId: mergedPhotos.newestSubmissionId,
      capturedAt: mergedPhotos.newestCapturedAt,
      photos: mergedPhotos.live,
      photoOriginNode: firstUrl ? photoOriginNode(firstUrl) : null,
    };
  }

  const overrideMap = await loadOverridesForCanonicalIds([property.canonicalId]);
  const resolved = resolveOne(property, overrideMap.get(property.canonicalId) ?? []);
  const effectiveProperty = {
    ...property,
    name: resolved.effective.name,
    location: resolved.effective.location,
    lat: resolved.effective.lat,
    lon: resolved.effective.lon,
  };

  const propertyDetail = buildPropertyDetail(
    effectiveProperty,
    collapsedFacts,
    auditPhotos?.photos.map((p) => ({ url: p.url, caption: p.caption })) ?? []
  );

  const authUser = await getAuthUser(req);
  const me = authUser ? auditorId(authUser) : null;
  propertyDetail.isClaimedByMe = Boolean(
    me && propertyDetail.claimedByUserId && propertyDetail.claimedByUserId === me
  );


  const confidenceSummary = buildConfidenceSummary(
    collapsedFacts,
    auditPhotos?.capturedAt ?? null
  );

  return NextResponse.json({
    propertyId: id,
    property: propertyDetail,
    facts: enrichedFacts,
    auditPhotos,
    auditPhotoHistory: mergedPhotos.history,
    auditNotes,
    auditSubmissions: submissionsRaw.map((sub) => ({
      id: sub.id,
      createdAt: sub.createdAt.toISOString(),
      auditorToken: sub.auditorToken,
      locale: sub.locale,
      factCount: Array.isArray(sub.facts) ? sub.facts.length : 0,
      photoCount: sub.photos.length,
    })),
    hasAiGuess,
    confidenceSummary,
  });
}

// POST /api/properties/:id/accessibility
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireRole(req, "AUDITOR");
  if (authError) return authError;

  const { id } = await params;

  const authUser = await getAuthUser(req);
  const submitter = authUser ? auditorId(authUser) : null;

  let body: {
    facts?: FactInput[];
    photoUrls?: string[];
    photos?: PhotoInput[];
    locale?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (!body.facts || !Array.isArray(body.facts) || body.facts.length === 0) {
    return NextResponse.json({ message: "facts array is required" }, { status: 400 });
  }

  const property = await prisma.property.findFirst({
    where: {
      OR: [{ id }, { canonicalId: id }],
    },
  });
  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  for (const fact of body.facts) {
    if (
      typeof fact.fieldName !== "string" ||
      typeof fact.value !== "string" ||
      fact.fieldName.trim() === "" ||
      fact.value.trim() === ""
    ) {
      return NextResponse.json(
        { message: "Each fact must have non-empty fieldName and value strings" },
        { status: 400 }
      );
    }
  }

  const propertyId = property.id;
  const submissionLocale =
    body.locale && isSupportedLocale(body.locale) ? body.locale : null;
  const fieldRegistry = await getFieldRegistryMap(submissionLocale ?? undefined);

  const allFactsRaw = await prisma.accessibilityFact.findMany({
    where: { propertyId },
    orderBy: { timestamp: "desc" },
  });

  const allFacts = allFactsRaw.map((f) => ({
    id: f.id,
    propertyId: f.propertyId,
    fieldName: f.fieldName,
    scopeKey: f.scopeKey,
    value: f.value,
    valueLocale: f.valueLocale,
    tier: f.tier as Tier,
    sourceType: f.sourceType as SourceType,
    sourceNodeId: f.sourceNodeId,
    submittedBy: f.submittedBy,
    timestamp: f.timestamp.toISOString(),
    signatureHash: f.signatureHash,
  }));

  const evaluated = evaluateMeshTruth(allFacts);
  const meshByKey = new Map<string, (typeof evaluated)[0]>();
  for (const fact of evaluated) {
    const key = factKey(fact);
    const existing = meshByKey.get(key);
    if (
      !existing ||
      fact.tier > existing.tier ||
      (fact.tier === existing.tier && fact.timestamp > existing.timestamp)
    ) {
      meshByKey.set(key, fact);
    }
  }

  const localByKey = new Map(
    allFactsRaw
      .filter((f) => f.sourceNodeId === NODE_ID)
      .map((f) => [factKey(f), f])
  );

  const validation = await validateAuditFacts(
    body.facts.map((f) => ({
      fieldName: f.fieldName,
      value: f.value,
      scopeKey: f.scopeKey ?? "property",
      confirm: f.confirm,
    })),
    submissionLocale ?? undefined
  );
  if (!validation.ok) {
    return NextResponse.json({ message: validation.message }, { status: 422 });
  }
  const facts = validation.facts;

  for (const fact of facts) {
    if (!fact.confirm) continue;
    const scopeKey = fact.scopeKey ?? "property";
    const key = factKey({ fieldName: fact.fieldName, scopeKey });
    const meshFact = meshByKey.get(key);
    if (!meshFact) {
      return NextResponse.json(
        { message: `Cannot confirm ${fact.fieldName}: no existing value` },
        { status: 422 }
      );
    }
    if (!factValuesMatch(fieldRegistry.get(fact.fieldName), meshFact.value, fact.value)) {
      return NextResponse.json(
        { message: `Confirm value for ${fact.fieldName} must match existing value` },
        { status: 422 }
      );
    }
  }

  const storage = await getPhotoStorage();
  const photoInputs: PhotoInput[] = [];

  if (Array.isArray(body.photos) && body.photos.length > 0) {
    photoInputs.push(...body.photos.slice(0, MAX_AUDIT_PHOTOS));
  } else if (Array.isArray(body.photoUrls)) {
    photoInputs.push(
      ...body.photoUrls.slice(0, MAX_AUDIT_PHOTOS).map((dataUri) => ({ dataUri }))
    );
  }

  const storedPhotos: Array<{
    url: string;
    caption: string | null;
    fieldName: string | null;
    scopeKey: string | null;
    width: number | null;
    height: number | null;
    sortOrder: number;
  }> = [];

  for (let i = 0; i < photoInputs.length; i++) {
    const p = photoInputs[i];
    const dataUri = p.dataUri ?? p.url;
    if (!dataUri) continue;

    let url = dataUri;
    if (dataUri.startsWith("data:")) {
      const ext = dataUri.match(/data:image\/(\w+)/)?.[1] ?? "jpg";
      const key = `photos/${propertyId}/${crypto.randomUUID()}-${i}.${ext}`;
      url = await storage.upload(dataUri, key);
    }

    storedPhotos.push({
      url,
      caption: p.caption?.trim() || null,
      fieldName: p.fieldName ?? null,
      scopeKey: p.scopeKey ?? null,
      width: p.width ?? null,
      height: p.height ?? null,
      sortOrder: i,
    });
  }

  const submission = await prisma.auditSubmission.create({
    data: {
      propertyId,
      auditorToken: submitter,
      facts,
      photoUrls: storedPhotos.map((p) => p.url),
      locale: body.locale ?? null,
      photos: storedPhotos.length
        ? { create: storedPhotos }
        : undefined,
    },
  });

  await Promise.all(
    facts.map(async (fact) => {
      const scopeKey = fact.scopeKey ?? "property";
      const key = factKey({ fieldName: fact.fieldName, scopeKey });
      const def = fieldRegistry.get(fact.fieldName);
      const isText = def?.valueType === "TEXT";
      // A field audit is always VERIFIED. CONFIRMED is only via evaluateConfirmed (≥3 auditors).
      const tier = "VERIFIED" as const;
      const localExisting = localByKey.get(key);
      const meshFact = meshByKey.get(key);

      if (
        !fact.confirm &&
        localExisting &&
        !factValuesMatch(def, localExisting.value, fact.value)
      ) {
        await invalidateFactTranslations(localExisting.id);
      }

      const valueLocale = fact.confirm
        ? (localExisting?.valueLocale ??
          allFactsRaw.find((f) => f.id === meshFact?.id)?.valueLocale ??
          undefined)
        : isText && submissionLocale
          ? submissionLocale
          : undefined;

      return prisma.accessibilityFact.upsert({
        where: {
          propertyId_fieldName_sourceNodeId_scopeKey: {
            propertyId,
            fieldName: fact.fieldName,
            sourceNodeId: NODE_ID,
            scopeKey,
          },
        },
        update: {
          value: fact.value,
          tier,
          submittedBy: submitter,
          timestamp: new Date(),
          ...(valueLocale ? { valueLocale } : {}),
        },
        create: {
          propertyId,
          fieldName: fact.fieldName,
          scopeKey,
          value: fact.value,
          tier,
          sourceType: "AUDITOR",
          sourceNodeId: NODE_ID,
          submittedBy: submitter,
          valueLocale: valueLocale ?? null,
        },
      });
    })
  );

  const visionPhotos = storedPhotos
    .slice(0, AI_VISION_PHOTO_BUDGET)
    .map((p) => p.url);

  if ((process.env.AI_API_KEY || process.env.OPENAI_API_KEY) && visionPhotos.length > 0) {
    void runAiAnalysis({
      propertyId,
      propertyName: property.name,
      location: property.location,
      photos: visionPhotos,
      skipExistingAiGuess: false,
    }).catch((err) =>
      console.error("[accessibility] background vision analysis failed:", err)
    );
  }

  if (submitter) {
    void pushFactsToPeers(
      [
        {
          id: property.id,
          canonicalId: property.canonicalId,
          name: property.name,
          location: property.location,
          lat: property.lat,
          lon: property.lon,
          osmId: property.osmId,
          wheelmapId: property.wheelmapId,
        },
      ],
      facts.map((fact) => ({
        id: `${NODE_ID}-${propertyId}-${fact.scopeKey ?? "property"}-${fact.fieldName}`,
        propertyId,
        fieldName: fact.fieldName,
        scopeKey: fact.scopeKey ?? "property",
        value: fact.value,
        tier: "VERIFIED" as Tier,
        sourceType: "AUDITOR" as SourceType,
        sourceNodeId: NODE_ID,
        submittedBy: submitter,
        timestamp: new Date().toISOString(),
        signatureHash: null,
      }))
    ).catch((err) =>
      console.error("[accessibility] peer push failed:", err)
    );
  }

  return NextResponse.json({
    message: "Audit accepted",
    propertyId: id,
    submissionId: submission.id,
  });
}
