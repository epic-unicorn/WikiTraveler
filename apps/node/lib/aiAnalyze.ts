/**
 * lib/aiAnalyze.ts
 *
 * Shared helper used by:
 *   - POST /api/properties/[id]/analyze  (on-demand, JWT-protected)
 *   - GET  /api/cron/ai-scan             (batch cron)
 *   - POST /api/properties/[id]/accessibility  (fire-and-forget after photo upload)
 *
 * Runs vision analysis when photos are supplied, then gap-fills any fields
 * still missing. Upserts resulting AI_GUESS facts into the database.
 */

import { prisma } from "@/lib/prisma";
import { NODE_ID } from "@/lib/nodeInfo";
import { analyzePhotos, gapFill } from "@wikitraveler/ai-agent";
import { ACCESSIBILITY_FIELDS } from "@wikitraveler/core";
import type { AgentFact } from "@wikitraveler/ai-agent";

/** Source node suffix for all AI-generated facts. */
const AI_SOURCE_NODE = `${NODE_ID}:ai-agent`;

export interface AiAnalyzeOptions {
  propertyId: string;
  propertyName: string;
  location: string;
  /** base64 strings or data-URIs — passed directly to GPT-4o vision. */
  photos?: string[];
  /**
   * When true, already-existing AI_GUESS facts are also included in the
   * "existing" set so the gap-filler does not re-estimate them.
   * Set false to force a full re-analysis.
   */
  skipExistingAiGuess?: boolean;
}

export interface AiAnalyzeSummary {
  visionFactsAdded: number;
  gapFactsAdded: number;
  skipped: number;
}

export async function runAiAnalysis(
  opts: AiAnalyzeOptions
): Promise<AiAnalyzeSummary> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured on this node.");

  const {
    propertyId,
    propertyName,
    location,
    photos = [],
    skipExistingAiGuess = true,
  } = opts;

  // ------------------------------------------------------------------
  // 1. Determine which fields already have data >= the tier we produce.
  //    We never overwrite COMMUNITY or MESH_TRUTH with AI_GUESS.
  // ------------------------------------------------------------------
  const existingFacts = await prisma.accessibilityFact.findMany({
    where: { propertyId },
    select: { fieldName: true, tier: true },
  });

  const protectedFields = new Set(
    existingFacts
      .filter((f: { fieldName: string; tier: string }) =>
        f.tier === "COMMUNITY" ||
        f.tier === "MESH_TRUTH" ||
        (skipExistingAiGuess && f.tier === "AI_GUESS")
      )
      .map((f: { fieldName: string; tier: string }) => f.fieldName)
  );

  // Fields that the gap-filler should skip entirely
  const allExistingNames = existingFacts.map((f) => f.fieldName);

  // ------------------------------------------------------------------
  // 2. Run vision analysis if photos were supplied.
  // ------------------------------------------------------------------
  let visionFacts: AgentFact[] = [];
  if (photos.length > 0) {
    const raw = await analyzePhotos(photos, apiKey);
    visionFacts = raw.filter(
      (f) =>
        ACCESSIBILITY_FIELDS.includes(f.fieldName as never) &&
        !protectedFields.has(f.fieldName)
    );
  }

  // Fields now covered by vision — don't gap-fill them too
  const visionFieldNames = new Set(visionFacts.map((f) => f.fieldName));
  const gapSkipFields = [
    ...allExistingNames,
    ...Array.from(visionFieldNames),
  ];

  // ------------------------------------------------------------------
  // 3. Run gap-fill for everything not already covered.
  // ------------------------------------------------------------------
  const rawGap = await gapFill(propertyName, location, gapSkipFields, apiKey);
  const gapFacts = rawGap.filter(
    (f) =>
      ACCESSIBILITY_FIELDS.includes(f.fieldName as never) &&
      !protectedFields.has(f.fieldName) &&
      !visionFieldNames.has(f.fieldName)
  );

  // ------------------------------------------------------------------
  // 4. Upsert all new AI_GUESS facts.
  //    We use createMany with skipDuplicates=false by doing individual
  //    upserts so existing AI_GUESS records are refreshed.
  // ------------------------------------------------------------------
  const toUpsert = [...visionFacts, ...gapFacts];
  let skipped = 0;

  await Promise.all(
    toUpsert.map(async (fact) => {
      if (protectedFields.has(fact.fieldName)) {
        skipped++;
        return;
      }
      await prisma.accessibilityFact.upsert({
        where: {
          propertyId_fieldName_sourceNodeId: {
            propertyId,
            fieldName: fact.fieldName,
            sourceNodeId: AI_SOURCE_NODE,
          },
        },
        update: {
          value: fact.value,
          tier: "AI_GUESS",
          timestamp: new Date(),
          // Store evidence + confidence in signatureHash for audit trail
          signatureHash: JSON.stringify({
            confidence: fact.confidence,
            evidence: fact.evidence,
          }),
        },
        create: {
          propertyId,
          fieldName: fact.fieldName,
          value: fact.value,
          tier: "AI_GUESS",
          sourceType: "COMMUNITY",
          sourceNodeId: AI_SOURCE_NODE,
          submittedBy: "ai-agent",
          signatureHash: JSON.stringify({
            confidence: fact.confidence,
            evidence: fact.evidence,
          }),
        },
      });
    })
  );

  return {
    visionFactsAdded: visionFacts.length,
    gapFactsAdded: gapFacts.length,
    skipped,
  };
}
