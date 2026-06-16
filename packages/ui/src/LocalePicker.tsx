"use client";

import { useLocale, SUPPORTED_LOCALES, LOCALE_LABELS } from "./LocaleProvider";

interface Props {
  compact?: boolean;
}

export function LocalePicker({ compact = false }: Props) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div style={{ display: "flex", flexDirection: compact ? "row" : "column", gap: compact ? 8 : 4, alignItems: compact ? "center" : "stretch" }}>
      {!compact && (
        <label htmlFor="wt-locale" style={{ fontSize: 13, fontWeight: 600 }}>
          {t("ui.language")}
        </label>
      )}
      <select
        id="wt-locale"
        value={locale}
        onChange={(e) => setLocale(e.target.value as typeof locale)}
        aria-label={t("ui.language")}
        style={{
          padding: compact ? "6px 10px" : "10px 12px",
          fontSize: compact ? 13 : 15,
          borderRadius: "var(--wt-radius-sm, 8px)",
          border: "1px solid var(--wt-border, #e2e8f0)",
          background: "var(--wt-bg-elevated, #fff)",
          color: "var(--wt-text, #0f172a)",
          minHeight: compact ? 36 : 44,
        }}
      >
        {SUPPORTED_LOCALES.map((loc) => (
          <option key={loc} value={loc}>
            {LOCALE_LABELS[loc]}
          </option>
        ))}
      </select>
    </div>
  );
}
