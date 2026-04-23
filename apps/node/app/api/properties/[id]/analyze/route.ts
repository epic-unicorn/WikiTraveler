import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { runAiAnalysis } from "@/lib/aiAnalyze";
import type { NextRequest } from "next/server";

/**
 * POST /api/properties/:id/analyze
 *
 * Triggers AI analysis (vision + gap-fill) for a single property.
 * JWT-protected — node operators or trusted auditors only.
 *
 * Request body (all optional):
 *   { "photos": ["<base64>", ...], "forceRefresh": false }
 *
 * - photos: up to 3 base64 strings or data-URIs to run through vision analysis.
 *   If omitted, the most recent AuditSubmission with photos will be used.
 * - forceRefresh: when true, re-estimates even fields that already have AI_GUESS facts.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireRole(req, "AUDITOR");
  if (authError) return authError;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { message: "OPENAI_API_KEY is not configured on this node." },
      { status: 503 }
    );
  }

  const property = await prisma.property.findUnique({
    where: { id: params.id },
  });
  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  let body: { photos?: string[]; forceRefresh?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // No body is fine — we'll use stored photos
  }

  // If caller didn't supply photos, look for the most recent audit submission that has them
  let photos = Array.isArray(body.photos) ? body.photos.slice(0, 3) : [];
  if (photos.length === 0) {
    const latestWithPhotos = await prisma.auditSubmission.findFirst({
      where: {
        propertyId: params.id,
        NOT: { photoUrls: { equals: [] } },
      },
      orderBy: { createdAt: "desc" },
    });
    if (latestWithPhotos && Array.isArray(latestWithPhotos.photoUrls)) {
      photos = (latestWithPhotos.photoUrls as string[]).slice(0, 3);
    }
  }

  try {
    const summary = await runAiAnalysis({
      propertyId: params.id,
      propertyName: property.name,
      location: property.location,
      photos,
      skipExistingAiGuess: !(body.forceRefresh ?? false),
    });

    return NextResponse.json({
      propertyId: params.id,
      ...summary,
      message: `AI analysis complete. ${summary.visionFactsAdded} vision facts, ${summary.gapFactsAdded} gap-fill facts added.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI analysis failed";
    console.error("[analyze] error:", err);
    return NextResponse.json({ message }, { status: 500 });
  }
}
