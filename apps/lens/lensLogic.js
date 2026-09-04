/**
 * Pure Lens helpers — shared by popup (ES module) and unit tests.
 * No DOM / chrome.* APIs.
 */

export const DEFAULT_NODE_URL = "https://node-eu.wikitraveler.org";
export const ACCESS_HUB_URL = "https://access.wikitraveler.org";
export const ONBOARDING_KEY = "lensOnboardingDone";

/** Coverage categories — mirrors Access PropertyDetail score model. */
export const CATEGORY_EXPECTED = [
  { id: "mobility", labelKey: "ui.auditStepMobility", steps: ["entrance", "mobility"], expected: 11 },
  { id: "room", labelKey: "ui.auditStepRoom", steps: ["room"], expected: 7 },
  { id: "bathroom", labelKey: "ui.auditStepBathroom", steps: ["bathroom"], expected: 3 },
  { id: "communication", labelKey: "ui.auditStepCommunication", steps: ["communication"], expected: 5 },
];

export const FIELD_STEP = {
  step_free_entrance: "entrance",
  automatic_door: "entrance",
  ramp_present: "entrance",
  door_width_cm: "entrance",
  path_to_entrance: "entrance",
  elevator_present: "mobility",
  elevator_width_cm: "mobility",
  corridor_min_width_cm: "mobility",
  parking_accessible: "mobility",
  pool_lift: "mobility",
  room_types_available: "room",
  accessible_room_description: "room",
  step_free_room: "room",
  clear_space_beside_bed: "room",
  bed_height_cm: "room",
  turning_circle_cm: "room",
  accessible_bathroom: "bathroom",
  roll_in_shower: "bathroom",
  grab_bars_bathroom: "bathroom",
  hearing_loop: "communication",
  braille_signage: "communication",
  tactile_paving: "communication",
  visual_alarms: "communication",
  service_animal_policy: "communication",
};

export const FEATURE_HIGHLIGHTS = [
  "step_free_entrance",
  "accessible_bathroom",
  "elevator_present",
  "parking_accessible",
];

export function truthyFactValue(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v || v === "no" || v === "n/a" || v === "false" || v === "0") return false;
  return true;
}

export function computeCategoryBars(facts) {
  const byStep = {};
  for (const f of facts ?? []) {
    const step = FIELD_STEP[f.fieldName];
    if (!step) continue;
    byStep[step] = (byStep[step] ?? 0) + 1;
  }
  return CATEGORY_EXPECTED.map((cat) => {
    const count = cat.steps.reduce((sum, s) => sum + (byStep[s] ?? 0), 0);
    const pct = Math.min(100, Math.round((count / cat.expected) * 100));
    return { id: cat.id, labelKey: cat.labelKey, pct, count };
  });
}

/** Overall score = expected-field-weighted coverage across categories (0–100), or null. */
export function overallAccessibilityScore(bars) {
  let weighted = 0;
  let expected = 0;
  for (let i = 0; i < CATEGORY_EXPECTED.length; i++) {
    const bar = bars[i];
    if (!bar) continue;
    weighted += bar.pct * CATEGORY_EXPECTED[i].expected;
    expected += CATEGORY_EXPECTED[i].expected;
  }
  if (expected <= 0) return null;
  if (bars.every((b) => b.pct === 0)) return null;
  return Math.round(weighted / expected);
}

export function scoreFromFacts(facts) {
  const bars = computeCategoryBars(facts);
  return { bars, score: overallAccessibilityScore(bars) };
}

export function propertyViewUrl(nodeUrl, propertyId) {
  return `${ACCESS_HUB_URL}/properties/${encodeURIComponent(propertyId)}?node=${encodeURIComponent(nodeUrl)}`;
}

export function isAllowedNodeUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Strip OTA suffixes from a browser tab title to guess the hotel name. */
export function extractHotelNameFromTitle(title) {
  return String(title ?? "")
    .replace(/\s*[|\u2013\u2014]\s*(Booking\.com|Expedia|Hotels\.com|Agoda).*$/i, "")
    .replace(/,\s*[A-Z][^,]+.*$/, "")
    .trim();
}

export function featurePresence(facts, fieldNames = FEATURE_HIGHLIGHTS) {
  const byName = new Map((facts ?? []).map((f) => [f.fieldName, f]));
  return fieldNames.map((fieldName) => {
    const fact = byName.get(fieldName);
    return {
      fieldName,
      present: Boolean(fact && truthyFactValue(fact.value)),
    };
  });
}
