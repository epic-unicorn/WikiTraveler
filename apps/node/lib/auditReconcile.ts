import { factKey } from "@wikitraveler/core";
import { prisma } from "@/lib/prisma";
import { NODE_ID } from "@/lib/nodeInfo";
import { factValuesMatch, getFieldRegistryMap } from "@/lib/fieldRegistry";
import { invalidateFactTranslations } from "@/lib/translation";

export type SubmissionFact = {
  fieldName: string;
  value: string;
  scopeKey?: string;
};

function asSubmissionFacts(raw: unknown): SubmissionFact[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is SubmissionFact =>
      typeof f === "object" &&
      f !== null &&
      typeof (f as SubmissionFact).fieldName === "string" &&
      typeof (f as SubmissionFact).value === "string"
  );
}

/**
 * After removing an audit submission, drop local facts that still match that
 * submission and were not superseded by a newer submission.
 */
export async function reconcileFactsAfterSubmissionDelete(opts: {
  propertyId: string;
  deletedSubmissionId: string;
  deletedFacts: unknown;
  deletedAuditor: string | null;
  deletedAt: Date;
  remainingSubmissions: Array<{
    id: string;
    createdAt: Date;
    facts: unknown;
  }>;
}): Promise<{ removed: number; skipped: number }> {
  const facts = asSubmissionFacts(opts.deletedFacts);
  if (facts.length === 0) return { removed: 0, skipped: 0 };

  const newerOverrides = new Set<string>();
  for (const sub of opts.remainingSubmissions) {
    if (sub.createdAt <= opts.deletedAt) continue;
    for (const f of asSubmissionFacts(sub.facts)) {
      newerOverrides.add(factKey({ fieldName: f.fieldName, scopeKey: f.scopeKey ?? "property" }));
    }
  }

  const fieldRegistry = await getFieldRegistryMap();
  let removed = 0;
  let skipped = 0;

  for (const fact of facts) {
    const scopeKey = fact.scopeKey ?? "property";
    const key = factKey({ fieldName: fact.fieldName, scopeKey });
    if (newerOverrides.has(key)) {
      skipped++;
      continue;
    }

    const existing = await prisma.accessibilityFact.findUnique({
      where: {
        propertyId_fieldName_sourceNodeId_scopeKey: {
          propertyId: opts.propertyId,
          fieldName: fact.fieldName,
          sourceNodeId: NODE_ID,
          scopeKey,
        },
      },
    });

    if (!existing) {
      skipped++;
      continue;
    }

    const def = fieldRegistry.get(fact.fieldName);
    const valueMatches = factValuesMatch(def, existing.value, fact.value);
    const auditorMatches =
      !opts.deletedAuditor || existing.submittedBy === opts.deletedAuditor;

    if (!valueMatches || !auditorMatches) {
      skipped++;
      continue;
    }

    await invalidateFactTranslations(existing.id);
    await prisma.accessibilityFact.delete({ where: { id: existing.id } });
    removed++;
  }

  return { removed, skipped };
}
