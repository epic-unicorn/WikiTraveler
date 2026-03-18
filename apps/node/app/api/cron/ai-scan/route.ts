import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAiAnalysis } from "@/lib/aiAnalyze";
import type { NextRequest } from "next/server";

/**
 * GET /api/cron/ai-scan
 *
 * Batch job that finds all properties with zero AI_GUESS facts and runs
 * gap-fill analysis on each. Does NOT run vision (no photos needed).
 *
 * Protected by CRON_SECRET. Schedule in vercel.json or run from a cron
 * container alongside the node.
 *
 * Query params:
 *   - limit: max properties to process per run (default 20, max 50)
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { message: "OPENAI_API_KEY is not configured on this node — ai-scan skipped." },
      { status: 503 }
    );
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(parseInt(limitParam ?? "20", 10) || 20, 50);

  // Find properties that have no AI_GUESS facts at all
  const propertiesWithAiGuess = await prisma.accessibilityFact.findMany({
    where: { tier: "AI_GUESS" },
    select: { propertyId: true },
    distinct: ["propertyId"],
  });
  const coveredIds = new Set(propertiesWithAiGuess.map((f) => f.propertyId));

  const properties = await prisma.property.findMany({
    where: {
      id: { notIn: Array.from(coveredIds) },
    },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  if (properties.length === 0) {
    return NextResponse.json({
      message: "All properties already have AI_GUESS coverage.",
      processed: 0,
    });
  }

  const results: Array<{
    propertyId: string;
    name: string;
    ok: boolean;
    visionFactsAdded?: number;
    gapFactsAdded?: number;
    error?: string;
  }> = [];

  for (const property of properties) {
    try {
      // Gap-fill only (no photos in batch mode — use /analyze for vision)
      const summary = await runAiAnalysis({
        propertyId: property.id,
        propertyName: property.name,
        location: property.location,
        photos: [],
        skipExistingAiGuess: true,
      });
      results.push({
        propertyId: property.id,
        name: property.name,
        ok: true,
        ...summary,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : "unknown error";
      console.error(`[ai-scan] failed for ${property.id}:`, err);
      results.push({ propertyId: property.id, name: property.name, ok: false, error });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;
  const totalFacts = results.reduce(
    (sum, r) => sum + (r.gapFactsAdded ?? 0) + (r.visionFactsAdded ?? 0),
    0
  );

  return NextResponse.json({
    processed: results.length,
    succeeded,
    failed,
    totalFactsAdded: totalFacts,
    results,
  });
}
