/** Boolean accessibility fields exposed in search filters. */
export const SEARCH_FEATURES = [
  { key: "step_free_entrance", label: "Step-free entrance" },
  { key: "accessible_bathroom", label: "Accessible bathroom" },
  { key: "ramp_present", label: "Ramp" },
  { key: "elevator_present", label: "Elevator" },
  { key: "hearing_loop", label: "Hearing loop" },
  { key: "braille_signage", label: "Braille signage" },
  { key: "parking_accessible", label: "Accessible parking" },
] as const;

export type ThemeMode = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "wt-theme";

export function fieldLabel(field: string): string {
  return field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getTierStyle(tier: string): { background: string; color: string } {
  const map: Record<string, { background: string; color: string }> = {
    OFFICIAL: { background: "var(--wt-tier-official-bg)", color: "var(--wt-tier-official-text)" },
    AI_GUESS: { background: "var(--wt-tier-ai-bg)", color: "var(--wt-tier-ai-text)" },
    VERIFIED: { background: "var(--wt-tier-verified-bg)", color: "var(--wt-tier-verified-text)" },
    CONFIRMED: { background: "var(--wt-tier-confirmed-bg)", color: "var(--wt-tier-confirmed-text)" },
  };
  return map[tier] ?? map.OFFICIAL;
}
