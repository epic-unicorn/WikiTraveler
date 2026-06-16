"use client";

import { useTheme } from "./ThemeProvider";
import { useLocale } from "./LocaleProvider";
import type { ThemeMode } from "./constants";

const CYCLE: ThemeMode[] = ["system", "light", "dark"];

const ICON: Record<ThemeMode, string> = {
  system: "◐",
  light: "☀",
  dark: "☾",
};

interface Props {
  compact?: boolean;
  variant?: "header" | "toolbar" | "page";
}

export function ThemeToggle({ compact, variant = "toolbar" }: Props) {
  const { mode, setMode } = useTheme();
  const { t } = useLocale();

  const LABEL: Record<ThemeMode, string> = {
    system: t("ui.themeAuto"),
    light: t("ui.themeLight"),
    dark: t("ui.themeDark"),
  };

  function cycle() {
    const idx = CYCLE.indexOf(mode);
    setMode(CYCLE[(idx + 1) % CYCLE.length]);
  }

  const label = `${t("ui.theme")}: ${LABEL[mode]}`;

  if (variant === "toolbar") {
    return (
      <button
        type="button"
        onClick={cycle}
        className="wt-toolbar-btn"
        title={label}
        aria-label={`${label}. Click to change.`}
      >
        {ICON[mode]}
        {!compact && <span>{LABEL[mode]}</span>}
      </button>
    );
  }

  const isPage = variant === "page";

  return (
    <button
      type="button"
      onClick={cycle}
      title={label}
      aria-label={`${label}. Click to change.`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 0 : 5,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: 1,
        borderRadius: 7,
        padding: "5px 10px",
        cursor: "pointer",
        transition: "opacity 0.12s",
        whiteSpace: "nowrap",
        color: isPage ? "var(--wt-text)" : "rgba(255,255,255,0.82)",
        background: isPage ? "var(--wt-bg-secondary)" : "rgba(255,255,255,0.08)",
        border: isPage ? "1px solid var(--wt-border)" : "1px solid rgba(255,255,255,0.16)",
      }}
    >
      {ICON[mode]}
      {!compact && <span>{LABEL[mode]}</span>}
    </button>
  );
}
