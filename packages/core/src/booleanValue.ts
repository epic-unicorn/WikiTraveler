/** Canonical tokens stored for BOOLEAN audit fields. */
export const BOOLEAN_VALUES = ["yes", "no", "partial", "n/a"] as const;
export type BooleanValue = (typeof BOOLEAN_VALUES)[number];

const ALIASES: Record<string, BooleanValue> = {
  yes: "yes",
  true: "yes",
  ja: "yes",
  oui: "yes",
  no: "no",
  false: "no",
  nee: "no",
  non: "no",
  partial: "partial",
  limited: "partial",
  gedeeltelijk: "partial",
  "n/a": "n/a",
  na: "n/a",
  "n.a.": "n/a",
  "n.v.t.": "n/a",
  nvt: "n/a",
  "not applicable": "n/a",
  "k. a.": "n/a",
  "k.a.": "n/a",
};

/**
 * Map OSM / Wheelmap / locale display aliases onto yes | no | partial | n/a.
 * Returns null when the string is not a boolean token.
 */
export function normalizeBooleanValue(raw: string): BooleanValue | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return ALIASES[key] ?? null;
}
