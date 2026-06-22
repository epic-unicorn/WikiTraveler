import { AI_GAP_FILL_FIELDS } from "@wikitraveler/core";
import type { AgentFact } from "./types";

const REJECTED_VALUES = new Set([
  "unknown",
  "n/a",
  "na",
  "none",
  "unclear",
  "not sure",
  "maybe",
  "unsure",
]);

/** Drop placeholder or empty values the model should have omitted. */
export function isUsableAiValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !REJECTED_VALUES.has(trimmed.toLowerCase());
}

const GAP_FILL_ALLOWED = new Set<string>(AI_GAP_FILL_FIELDS);

/** Gap-fill (no photos): only cautious notes, never specific attribute guesses. */
export function filterGapFillFacts(facts: AgentFact[]): AgentFact[] {
  return facts.filter(
    (f) => GAP_FILL_ALLOWED.has(f.fieldName) && isUsableAiValue(f.value)
  );
}

/** Vision: require medium+ confidence and no placeholder values. */
export function filterVisionFacts(facts: AgentFact[]): AgentFact[] {
  return facts.filter(
    (f) => f.confidence !== "low" && isUsableAiValue(f.value)
  );
}
