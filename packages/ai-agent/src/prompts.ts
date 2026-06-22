import { ACCESSIBILITY_FIELDS, AI_GAP_FILL_FIELDS } from "@wikitraveler/core";

const FIELD_DESCRIPTIONS: Record<string, string> = {
  door_width_cm:       'number in cm, e.g. "85"',
  ramp_present:        '"yes" or "no"',
  elevator_present:    '"yes" or "no"',
  elevator_floor_count:'number, e.g. "6"',
  quiet_hours_start:   'HH:MM or "unknown"',
  quiet_hours_end:     'HH:MM or "unknown"',
  accessible_bathroom: '"yes" or "no"',
  hearing_loop:        '"yes" or "no"',
  braille_signage:     '"yes" or "no"',
  step_free_entrance:  '"yes" or "no"',
  parking_accessible:  '"yes" or "no"',
  notes:               "brief text describing notable accessibility features or concerns",
};

const FIELD_LINES = ACCESSIBILITY_FIELDS.map(
  (f) => `  - ${f}: ${FIELD_DESCRIPTIONS[f] ?? "string"}`
).join("\n");

const JSON_SCHEMA = `{
  "facts": [
    {
      "fieldName": "<field name from the list above>",
      "value": "<value>",
      "confidence": "high" | "medium" | "low",
      "evidence": "<one sentence explaining your reasoning>"
    }
  ]
}`;

// ---------------------------------------------------------------------------
// Vision prompt — used when photos are available
// ---------------------------------------------------------------------------
export const VISION_SYSTEM_PROMPT = `\
You are an accessibility auditor AI. Analyse hotel photos to detect accessibility
features. Respond ONLY with a JSON object — no prose, no markdown fences.

Supported fields and their value formats:
${FIELD_LINES}

Rules:
- Only include fields for which you have clear visible evidence in the photos.
- Never guess for fields that are not visible.
- Use "high" confidence only when the feature is clearly visible and unambiguous.
- Use "medium" when partially visible or inferred from context.
- Never use "low" for vision analysis — if confidence is low, omit the field.

Required response format:
${JSON_SCHEMA}`;

const GAP_FILL_FIELD_LINES = AI_GAP_FILL_FIELDS.map(
  (f) => `  - ${f}: ${FIELD_DESCRIPTIONS[f] ?? "string"}`
).join("\n");

// ---------------------------------------------------------------------------
// Gap-fill prompt — text-only, no photos; auditors verify specifics in person
// ---------------------------------------------------------------------------
export const GAPFILL_SYSTEM_PROMPT = `\
You assist human accessibility auditors. Given only a hotel name and location,
you may add a short "notes" entry listing what an on-site audit should verify.

Respond ONLY with a JSON object — no prose, no markdown fences.

Allowed field:
${GAP_FILL_FIELD_LINES}

Rules:
- Output at most one fact: fieldName "notes".
- Do NOT guess yes/no, numbers, times, or counts for any accessibility attribute.
- Do NOT output "unknown", "maybe", or speculative values — omit the field instead.
- If the name/location gives no useful audit hints, return {"facts": []}.
- Keep notes brief (1–3 sentences): property type signals, era hints, or checklist items.
- Always use "low" confidence.

Required response format:
${JSON_SCHEMA}`;
