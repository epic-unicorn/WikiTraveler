import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, getAuthUser, auditorId } from "@/lib/auth";
import { evaluateMeshTruth, factKey } from "@wikitraveler/core";
import { NODE_ID, NODE_URL } from "@/lib/nodeInfo";
import { runAiAnalysis } from "@/lib/aiAnalyze";
import { pushFactsToPeers } from "@/lib/push";
import { getPhotoStorage, photoToDisplayUrl } from "@/lib/photoStorage";
import { validateAuditFacts } from "@/lib/fieldRegistry";
import { MAX_AUDIT_PHOTOS, AI_VISION_PHOTO_BUDGET } from "@wikitraveler/i18n";
import type { NextRequest } from "next/server";
import type { Tier, SourceType } from "@wikitraveler/core";

type FactInput = { fieldName: string; value: string; scopeKey?: string };

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
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const property = await prisma.property.findFirst({
    where: {
      OR: [{ id: params.id }, { canonicalId: params.id }],
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

  const latestAudit = await prisma.auditSubmission.findFirst({
    where: {
      propertyId: property.id,
      OR: [
        { NOT: { photoUrls: { equals: [] } } },
        { photos: { some: {} } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      photos: { orderBy: { sortOrder: "asc" } },
    },
  });

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
    }>;
    photoOriginNode: string | null;
  } | null = null;

  if (latestAudit) {
    const structured = latestAudit.photos.map((p) => ({
      id: p.id,
      url: photoToDisplayUrl(p.url),
      caption: p.caption,
      fieldName: p.fieldName,
      scopeKey: p.scopeKey,
      width: p.width,
      height: p.height,
    }));

    const legacy = normalizeLegacyPhotos(latestAudit.photoUrls).map((url, i) => ({
      id: `legacy-${i}`,
      url,
      caption: null as string | null,
      fieldName: null as string | null,
      scopeKey: null as string | null,
      width: null as number | null,
      height: null as number | null,
    }));

    const photos = structured.length > 0 ? structured : legacy;
    const firstUrl = photos[0]?.url ?? null;

    auditPhotos = {
      submissionId: latestAudit.id,
      capturedAt: latestAudit.createdAt.toISOString(),
      photos,
      photoOriginNode: firstUrl ? photoOriginNode(firstUrl) : null,
    };
  }

  return NextResponse.json({
    propertyId: params.id,
    property,
    facts: collapsedFacts,
    auditPhotos,
    hasAiGuess,
  });
}

// POST /api/properties/:id/accessibility
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireRole(req, "AUDITOR");
  if (authError) return authError;

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
      OR: [{ id: params.id }, { canonicalId: params.id }],
    },
  });
  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  const propertyId = property.id;

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

  const validation = await validateAuditFacts(
    body.facts.map((f) => ({
      fieldName: f.fieldName,
      value: f.value,
      scopeKey: f.scopeKey ?? "property",
    })),
    body.locale as import("@wikitraveler/i18n").Locale | undefined
  );
  if (!validation.ok) {
    return NextResponse.json({ message: validation.message }, { status: 422 });
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
      facts: body.facts,
      photoUrls: storedPhotos.map((p) => p.url),
      locale: body.locale ?? null,
      photos: storedPhotos.length
        ? { create: storedPhotos }
        : undefined,
    },
  });

  await Promise.all(
    body.facts.map((fact) => {
      const scopeKey = fact.scopeKey ?? "property";
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
          tier: "VERIFIED",
          submittedBy: submitter,
          timestamp: new Date(),
        },
        create: {
          propertyId,
          fieldName: fact.fieldName,
          scopeKey,
          value: fact.value,
          tier: "VERIFIED",
          sourceType: "AUDITOR",
          sourceNodeId: NODE_ID,
          submittedBy: submitter,
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
          osmId: property.osmId,
          wheelmapId: property.wheelmapId,
        },
      ],
      body.facts.map((fact) => ({
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
    propertyId: params.id,
    submissionId: submission.id,
  });
}
