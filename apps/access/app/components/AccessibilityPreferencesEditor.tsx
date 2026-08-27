"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@wikitraveler/ui";
import {
  readA11yPreferences,
  writeA11yPreferences,
  type A11yPreferenceKey,
  A11Y_PREFERENCE_OPTIONS,
} from "../lib/a11yPreferences";

export function AccessibilityPreferencesEditor() {
  const { t } = useLocale();
  const [selected, setSelected] = useState<A11yPreferenceKey[]>([]);

  useEffect(() => {
    setSelected(readA11yPreferences());
  }, []);

  function toggle(key: A11yPreferenceKey) {
    setSelected((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      writeA11yPreferences(next);
      return next;
    });
  }

  return (
    <div className="fk-a11y-prefs">
      <p className="fk-settings-theme-hint">{t("ui.a11yPreferencesHint")}</p>
      <div className="fk-a11y-prefs__chips" role="group" aria-label={t("ui.a11yPreferencesTitle")}>
        {A11Y_PREFERENCE_OPTIONS.map((key) => {
          const on = selected.includes(key);
          return (
            <button
              key={key}
              type="button"
              className={`fk-filter-chip${on ? " fk-filter-chip--active" : ""}`}
              aria-pressed={on}
              onClick={() => toggle(key)}
            >
              {t(`ui.a11yPref_${key}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
