const TIER_RANK: Record<string, number> = { OFFICIAL: 0, AI_GUESS: 1, VERIFIED: 2, CONFIRMED: 3 };
const AUDITED_TIERS = new Set(["VERIFIED", "CONFIRMED"]);

export type MapFactInput = { fieldName: string; value: string; tier: string };

/** Collapse facts to best tier per field and derive audited flag for map pins. */
export function collapseMapFacts(facts: MapFactInput[]) {
  const best = new Map<string, { value: string; tier: string }>();
  for (const f of facts) {
    const ex = best.get(f.fieldName);
    if (!ex || (TIER_RANK[f.tier] ?? 0) > (TIER_RANK[ex.tier] ?? 0)) {
      best.set(f.fieldName, { value: f.value, tier: f.tier });
    }
  }
  return {
    facts: Object.fromEntries(best) as Record<string, { value: string; tier: string }>,
    audited: facts.some((f) => AUDITED_TIERS.has(f.tier)),
  };
}

/** Safety cap for map pin payloads — prevents unbounded memory use in map clients. */
export const MAP_PIN_LIMIT = 5000;
