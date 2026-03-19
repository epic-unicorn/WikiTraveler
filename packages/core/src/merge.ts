import { Tier, TIER_RANK, AccessibilityFact, GossipDelta } from "./types";

/**
 * Given a list of facts for the same (propertyId, fieldName), return the one
 * with the highest reliability tier. If two facts share the same tier, the
 * most recently submitted one wins.
 */
export function pickWinningFact(
  facts: AccessibilityFact[]
): AccessibilityFact | null {
  if (facts.length === 0) return null;
  return facts.reduce((best, candidate) => {
    const bestRank = TIER_RANK[best.tier];
    const candidateRank = TIER_RANK[candidate.tier];
    if (candidateRank > bestRank) return candidate;
    if (
      candidateRank === bestRank &&
      new Date(candidate.timestamp) > new Date(best.timestamp)
    ) {
      return candidate;
    }
    return best;
  });
}

/**
 * Collapse a flat list of facts (from multiple nodes / submissions) into a
 * deduplicated map keyed by fieldName, keeping only the winning fact per field.
 */
export function collapseFacts(
  facts: AccessibilityFact[]
): Map<string, AccessibilityFact> {
  const grouped = new Map<string, AccessibilityFact[]>();
  for (const fact of facts) {
    const existing = grouped.get(fact.fieldName) ?? [];
    existing.push(fact);
    grouped.set(fact.fieldName, existing);
  }

  const result = new Map<string, AccessibilityFact>();
  for (const [fieldName, group] of grouped) {
    const winner = pickWinningFact(group);
    if (winner) result.set(fieldName, winner);
  }
  return result;
}

/**
 * Evaluate whether any facts in the list should be promoted to CONFIRMED.
 * A fact is promoted when ≥3 distinct human auditors (identified by
 * submittedBy) independently report the same (fieldName, value) for the
 * same propertyId.
 *
 * Gossip replication intentionally has no effect on this count — the same
 * auditor's submission reaching multiple nodes does not inflate the number.
 * Only facts with a non-null submittedBy are counted toward the threshold.
 *
 * Returns a new array with tier updates applied (originals are not mutated).
 */
export function evaluateConfirmed(
  facts: AccessibilityFact[],
  confirmThreshold = 3
): AccessibilityFact[] {
  type Key = string; // `${propertyId}::${fieldName}::${value}`
  const auditorSet = new Map<Key, Set<string>>();

  for (const fact of facts) {
    // Only count human-submitted facts (not AI or external feed facts)
    if (!fact.submittedBy) continue;
    const key: Key = `${fact.propertyId}::${fact.fieldName}::${fact.value}`;
    const auditors = auditorSet.get(key) ?? new Set();
    auditors.add(fact.submittedBy);
    auditorSet.set(key, auditors);
  }

  return facts.map((fact) => {
    const key: Key = `${fact.propertyId}::${fact.fieldName}::${fact.value}`;
    const agreeing = auditorSet.get(key)?.size ?? 0;
    if (agreeing >= confirmThreshold && fact.tier !== Tier.CONFIRMED) {
      return { ...fact, tier: Tier.CONFIRMED };
    }
    return fact;
  });
}

/** @deprecated Use evaluateConfirmed — kept for backwards compatibility. */
export const evaluateMeshTruth = evaluateConfirmed;

/**
 * Merge an incoming gossip delta into an existing facts array.
 * - Incoming COMMUNITY facts beat existing AI_GUESS for same (propertyId, fieldName).
 * - After merge, MESH_TRUTH evaluation is re-run.
 */
export function mergeGossipDelta(
  existing: AccessibilityFact[],
  delta: GossipDelta
): AccessibilityFact[] {
  const merged = [...existing];

  for (const incoming of delta.facts) {
    const idx = merged.findIndex(
      (f) =>
        f.propertyId === incoming.propertyId &&
        f.fieldName === incoming.fieldName &&
        f.sourceNodeId === incoming.sourceNodeId
    );

    if (idx === -1) {
      // New fact from this node — add it
      merged.push(incoming);
    } else {
      const existing_fact = merged[idx];
      // Update if the incoming fact has equal or higher tier, or is newer
      if (
        TIER_RANK[incoming.tier] > TIER_RANK[existing_fact.tier] ||
        new Date(incoming.timestamp) > new Date(existing_fact.timestamp)
      ) {
        merged[idx] = incoming;
      }
    }
  }

  return evaluateMeshTruth(merged);
}
