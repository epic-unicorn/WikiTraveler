"use client";

import { useTheme } from "./ThemeProvider";
import type { ThemeMode } from "./constants";

const CYCLE: ThemeMode[] = ["system", "light", "dark"];

const ICON: Record<ThemeMode, string> = {
  system: "◐",
  light: "☀",
  dark: "☾",
};

const LABEL: Record<ThemeMode, string> = {
  system: "Auto",
  light: "Light",
  dark: "Dark",
};

interface Props {
  compact?: boolean;
  /**
   * "header"  — white pill, for use on dark header backgrounds (default)
   * "page"    — token-based pill, for use on page/card backgrounds
   */
  variant?: "header" | "page";
}

export function ThemeToggle({ compact, variant = "header" }: Props) {
  const { mode, setMode } = useTheme();

  function cycle() {
    const idx = CYCLE.indexOf(mode);
    setMode(CYCLE[(idx + 1) % CYCLE.length]);
  }

  const isPage = variant === "page";

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${LABEL[mode]}`}
      aria-label={`Theme: ${LABEL[mode]}. Click to change.`}
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
        // Header variant: white-on-dark pill (matches other header items)
        // Page variant: token-based, readable on any page/card background
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
