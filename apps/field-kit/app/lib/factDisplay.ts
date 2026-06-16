import { getFieldLabel, getTierLabel, t } from "@wikitraveler/i18n";

export { getFieldLabel, getTierLabel };

/** @deprecated Use getFieldLabel */
export const formatFieldLabel = (fieldName: string, locale = "en") =>
  getFieldLabel(fieldName, locale);

export const TIER_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmed",
  VERIFIED: "Verified",
  AI_GUESS: "AI estimate",
  OFFICIAL: "Official",
};

const CONFIDENCE_ONLY = new Set(["high", "medium", "low"]);

export interface AiMeta {
  confidence?: string;
  evidence?: string;
}

export function formatFactValue(fieldName: string, value: string, locale = "en"): string {
  if (fieldName === "notes" || fieldName === "accessible_room_description" || fieldName === "service_animal_policy") {
    return value;
  }
  if (value === "yes") return t("ui.yes", locale);
  if (value === "no") return t("ui.no", locale);
  return value;
}

export interface ExistingFact {
  fieldName: string;
  scopeKey?: string;
  value: string;
  tier: string;
  sourceType?: string;
  signatureHash?: string | null;
}

export function parseAiMeta(signatureHash?: string | null): AiMeta | null {
  if (!signatureHash) return null;
  try {
    const parsed = JSON.parse(signatureHash) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as AiMeta;
  } catch {
    return null;
  }
}

export function resolveFactDisplay(
  fact: {
    fieldName?: string;
    value: string;
    tier: string;
    signatureHash?: string | null;
  },
  locale = "en"
) {
  const meta = fact.tier === "AI_GUESS" ? parseAiMeta(fact.signatureHash) : null;
  const rawValue = String(fact.value ?? "").trim();
  const confidence =
    typeof meta?.confidence === "string" ? meta.confidence.toLowerCase() : null;
  const evidence = typeof meta?.evidence === "string" ? meta.evidence.trim() : "";

  let displayValue = rawValue;
  if (
    fact.tier === "AI_GUESS" &&
    CONFIDENCE_ONLY.has(rawValue.toLowerCase()) &&
    evidence
  ) {
    displayValue = evidence;
  } else if (
    fact.tier === "AI_GUESS" &&
    CONFIDENCE_ONLY.has(rawValue.toLowerCase())
  ) {
    displayValue = t("ui.estimateUnavailable", locale);
  } else if (fact.fieldName) {
    displayValue = formatFactValue(fact.fieldName, rawValue, locale);
  }

  const label = fact.fieldName ? getFieldLabel(fact.fieldName, locale) : "";

  return { label, displayValue, confidence, evidence, rawValue };
}
