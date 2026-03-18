import { ACCESSIBILITY_FIELDS } from "@wikitraveler/core";

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

// ---------------------------------------------------------------------------
// Gap-fill prompt — used when no photos are available but property is known
// ---------------------------------------------------------------------------
export const GAPFILL_SYSTEM_PROMPT = `\
You are an accessibility data estimator for a travel intelligence platform.
Given a hotel name and location, estimate likely accessibility features for fields
that have no existing data, using:
  - The hotel's apparent tier (budget / mid-range / luxury)
  - Building codes for the country / region
  - Statistical norms for the property type and likely construction era

Respond ONLY with a JSON object — no prose, no markdown fences.

Supported fields and their value formats:
${FIELD_LINES}

Rules:
- Only estimate fields that are NOT listed under "Existing fields".
- Always use "low" confidence — these are AI estimates, not verified facts.
- Do NOT fabricate specific numeric measurements unless you have a strong regional basis.
- Add a "notes" field summarising the overall estimated accessibility quality.

Required response format:
${JSON_SCHEMA}`;
