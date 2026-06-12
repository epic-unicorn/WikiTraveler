"use client";

import { useTheme } from "./ThemeProvider";
import type { ThemeMode } from "./constants";

const CYCLE: ThemeMode[] = ["system", "light", "dark"];
const LABEL: Record<ThemeMode, string> = {
  system: "Auto",
  light: "Light",
  dark: "Dark",
};

interface Props {
  compact?: boolean;
}

export function ThemeToggle({ compact }: Props) {
  const { mode, setMode } = useTheme();

  function cycle() {
    const idx = CYCLE.indexOf(mode);
    setMode(CYCLE[(idx + 1) % CYCLE.length]);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${LABEL[mode]}`}
      aria-label={`Theme: ${LABEL[mode]}. Click to change.`}
      style={{
        background: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.25)",
        color: "inherit",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: compact ? 11 : 12,
        padding: compact ? "4px 8px" : "5px 12px",
        fontWeight: 500,
      }}
    >
      {mode === "dark" ? "🌙" : mode === "light" ? "☀️" : "◐"} {!compact && LABEL[mode]}
    </button>
  );
}
