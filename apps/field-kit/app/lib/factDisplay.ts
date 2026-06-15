export const FIELD_LABELS: Record<string, string> = {
  door_width_cm: "Door width (cm)",
  ramp_present: "Ramp present",
  elevator_present: "Elevator",
  elevator_floor_count: "Elevator floors",
  quiet_hours_start: "Quiet hours start",
  quiet_hours_end: "Quiet hours end",
  accessible_bathroom: "Accessible bathroom",
  hearing_loop: "Hearing loop",
  braille_signage: "Braille signage",
  step_free_entrance: "Step-free entrance",
  parking_accessible: "Accessible parking",
  notes: "Notes",
};

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

export function formatFieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] ?? fieldName.replace(/_/g, " ");
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

export function resolveFactDisplay(fact: {
  value: string;
  tier: string;
  signatureHash?: string | null;
}) {
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
    displayValue = "Estimate unavailable";
  }

  return { displayValue, confidence, evidence, rawValue };
}
