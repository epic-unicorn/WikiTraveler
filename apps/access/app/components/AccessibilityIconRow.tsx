"use client";

import { useLocale } from "@wikitraveler/ui";

const ICON_FIELDS: Array<{
  field: string;
  tone: "entrance" | "mobility" | "parking" | "sensory" | "hearing";
  labelKey: string;
  /** Minimal SVG path(s) in 24 viewBox */
  paths: string;
}> = [
  {
    field: "step_free_entrance",
    tone: "entrance",
    labelKey: "a11yPref_step_free_entrance",
    paths: "M4 20h16M8 20V10l4-4 4 4v10M12 14v6",
  },
  {
    field: "accessible_bathroom",
    tone: "mobility",
    labelKey: "a11yPref_accessible_bathroom",
    paths: "M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-4 6h8l-1.5 9h-5L8 11zm-2 3h2m10 0h2",
  },
  {
    field: "elevator_present",
    tone: "mobility",
    labelKey: "a11yPref_elevator_present",
    paths: "M5 3h14v18H5zM9 8l3-3 3 3M9 16l3 3 3-3",
  },
  {
    field: "parking_accessible",
    tone: "parking",
    labelKey: "a11yPref_parking_accessible",
    paths: "M8 4h6a4 4 0 0 1 0 8H8zm0 0v16",
  },
  {
    field: "braille_signage",
    tone: "sensory",
    labelKey: "a11yPref_braille_signage",
    paths: "M7 7h.01M12 7h.01M17 7h.01M7 12h.01M12 12h.01M17 12h.01M7 17h.01M12 17h.01",
  },
  {
    field: "hearing_loop",
    tone: "hearing",
    labelKey: "a11yPref_hearing_loop",
    paths: "M6 10a6 6 0 0 1 12 0M9 11a3 3 0 0 1 6 0v2a2 2 0 0 1-2 2h-1",
  },
  {
    field: "visual_alarms",
    tone: "hearing",
    labelKey: "a11yPref_visual_alarms",
    paths: "M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3l-1.4-1.4M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z",
  },
  {
    field: "ramp_present",
    tone: "entrance",
    labelKey: "a11yPref_ramp_present",
    paths: "M4 18h16L8 6H4z",
  },
];

function truthy(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v === "yes" || v === "true" || v === "partial";
}

interface Props {
  facts?: Array<{ fieldName: string; value: string }> | Record<string, { value: string }>;
  max?: number;
  /** Show short labels under icons (property detail). */
  withLabels?: boolean;
}

export function AccessibilityIconRow({ facts, max = 5, withLabels = false }: Props) {
  const { t } = useLocale();
  if (!facts) return null;

  const byName = new Map<string, string>();
  if (Array.isArray(facts)) {
    for (const f of facts) byName.set(f.fieldName, f.value);
  } else {
    for (const [k, v] of Object.entries(facts)) byName.set(k, v.value);
  }

  const present = ICON_FIELDS.filter((icon) => truthy(byName.get(icon.field)));
  if (present.length === 0) return null;

  const shown = present.slice(0, max);
  const more = present.length - shown.length;

  return (
    <div
      className={`fk-a11y-icons${withLabels ? " fk-a11y-icons--labeled" : ""}`}
      aria-label={t("ui.a11yPreferencesTitle")}
    >
      {shown.map((icon) => (
        <span key={icon.field} className={`fk-a11y-icon-wrap fk-a11y-icon-wrap--${icon.tone}`}>
          <span
            className={`fk-a11y-icon fk-a11y-icon--${icon.tone}`}
            title={t(`ui.${icon.labelKey}`)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={icon.paths} />
            </svg>
          </span>
          {withLabels && (
            <span className="fk-a11y-icon-label">{t(`ui.${icon.labelKey}`)}</span>
          )}
        </span>
      ))}
      {more > 0 && <span className="fk-a11y-icon-more">+{more}</span>}
    </div>
  );
}
