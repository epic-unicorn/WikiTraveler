"use client";

import { useState } from "react";
import { useLocale } from "./LocaleProvider";

export interface ProseFactValueProps {
  displayValue: string;
  rawValue: string;
  machineTranslated?: boolean;
  valueLocale?: string | null;
  className?: string;
}

export function ProseFactValue({
  displayValue,
  rawValue,
  machineTranslated,
  valueLocale,
  className = "",
}: ProseFactValueProps) {
  const { locale, t } = useLocale();
  const [showOriginal, setShowOriginal] = useState(false);
  const localesDiffer =
    machineTranslated ||
    (valueLocale != null && valueLocale !== locale && rawValue !== displayValue);

  if (!localesDiffer || rawValue === displayValue) {
    return <span className={className}>{displayValue}</span>;
  }

  return (
    <span className={`wt-prose-fact${className ? ` ${className}` : ""}`}>
      <span className="wt-prose-fact-primary">
        {showOriginal ? rawValue : displayValue}
      </span>
      {machineTranslated && !showOriginal ? (
        <span className="wt-prose-fact-badge">{t("ui.machineTranslation")}</span>
      ) : null}
      <button
        type="button"
        className="wt-prose-fact-toggle"
        onClick={() => setShowOriginal((v) => !v)}
      >
        {showOriginal ? t("ui.showTranslation") : t("ui.showOriginal")}
      </button>
    </span>
  );
}
