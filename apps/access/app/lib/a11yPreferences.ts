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
  window.dispatchEvent(new CustomEvent("wt-a11y-preferences"));
}
