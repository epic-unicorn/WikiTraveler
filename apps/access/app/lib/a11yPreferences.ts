/** Persistent accessibility search preferences (client + sync hook for Profile). */

export const A11Y_PREFERENCE_OPTIONS = [
  "step_free_entrance",
  "parking_accessible",
  "elevator_present",
  "accessible_bathroom",
  "hearing_loop",
  "braille_signage",
  "visual_alarms",
  "ramp_present",
] as const;

export type A11yPreferenceKey = (typeof A11Y_PREFERENCE_OPTIONS)[number];

const STORAGE_KEY = "wt_a11y_preferences";
const PREFS_EVENT = "wt-a11y-preferences";

export function readA11yPreferences(): A11yPreferenceKey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is A11yPreferenceKey =>
      (A11Y_PREFERENCE_OPTIONS as readonly string[]).includes(k)
    );
  } catch {
    return [];
  }
}

export function writeA11yPreferences(keys: A11yPreferenceKey[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  window.dispatchEvent(new CustomEvent(PREFS_EVENT));
}

export function subscribeA11yPreferences(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const notify = () => queueMicrotask(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) notify();
  };
  window.addEventListener(PREFS_EVENT, notify);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PREFS_EVENT, notify);
    window.removeEventListener("storage", onStorage);
  };
}

export function extrasFromFeatures(
  features: readonly string[],
  prefs: readonly string[]
): string[] {
  const prefSet = new Set(prefs);
  return features.filter((key) => !prefSet.has(key));
}

export function overridesFromFeatures(
  features: readonly string[],
  prefs: readonly string[]
): string[] {
  const on = new Set(features);
  return prefs.filter((key) => !on.has(key));
}

/** Profile prefs (minus session overrides) plus any extra search-only features. */
export function featuresFromPrefs(
  prefs: readonly string[],
  extras: readonly string[],
  overriddenOff: readonly string[]
): string[] {
  const off = new Set(overriddenOff);
  const prefSet = new Set(prefs);
  const applied = prefs.filter((key) => !off.has(key));
  const extra = extras.filter((key) => !prefSet.has(key));
  return [...applied, ...extra];
}

/**
 * True when the traveler started a typed / funnel search.
 * Profile preference chips alone must not count — those stay on during map browse
 * so “Search this area” still appears after pan/zoom.
 */
export function hasExplicitSearch(
  query: string,
  filters: {
    features: readonly string[];
    audited: boolean | null;
    hasAccessibleRoom?: boolean;
  },
  profilePrefs: readonly string[]
): boolean {
  if (query.trim().length > 0) return true;
  if (filters.audited !== null) return true;
  if (filters.hasAccessibleRoom === true) return true;
  return extrasFromFeatures(filters.features, profilePrefs).length > 0;
}
