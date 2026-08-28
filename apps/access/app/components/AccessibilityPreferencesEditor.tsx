"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@wikitraveler/ui";
import {
  readA11yPreferences,
  writeA11yPreferences,
  type A11yPreferenceKey,
  A11Y_PREFERENCE_OPTIONS,
} from "../lib/a11yPreferences";

interface Props {
  /** Start in read-only summary mode (profile card). */
  summary?: boolean;
}

export function AccessibilityPreferencesEditor({ summary = false }: Props) {
  const { t } = useLocale();
  const [selected, setSelected] = useState<A11yPreferenceKey[]>([]);
  const [editing, setEditing] = useState(!summary);

  useEffect(() => {
    setSelected(readA11yPreferences());
  }, []);

  function toggle(key: A11yPreferenceKey) {
    const next = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : [...selected, key];
    setSelected(next);
    writeA11yPreferences(next);
  }

  const chips = editing ? A11Y_PREFERENCE_OPTIONS : selected;

  return (
    <div className="fk-a11y-prefs">
      {!summary && <p className="fk-settings-theme-hint">{t("ui.a11yPreferencesHint")}</p>}
      {chips.length === 0 ? (
        <p className="fk-settings-theme-hint">{t("ui.a11yPreferencesEmpty")}</p>
      ) : (
        <div className="fk-a11y-prefs__chips" role="group" aria-label={t("ui.a11yPreferencesTitle")}>
          {chips.map((key) => {
            const on = selected.includes(key);
            return (
              <button
                key={key}
                type="button"
                className={`fk-filter-chip${on ? " fk-filter-chip--active" : ""}`}
                aria-pressed={on}
                disabled={!editing}
                onClick={() => toggle(key)}
              >
                {t(`ui.a11yPref_${key}`)}
              </button>
            );
          })}
        </div>
      )}
      {summary && (
        <button
          type="button"
          className="fk-card-link"
          onClick={() => setEditing((v) => !v)}
        >
          {t("ui.a11yPreferencesManage")}
          <span aria-hidden="true"> ›</span>
        </button>
      )}
    </div>
  );
}
