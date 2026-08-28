"use client";

import { useTheme } from "./ThemeProvider";
import { useLocale } from "./LocaleProvider";
import { THEME_MODES, type ThemeMode } from "./constants";

const ICON: Record<ThemeMode, string> = {
  light: "🌤️",
  dark: "🌙",
  contrast: "☀️",
  calm: "🌿",
};

interface Props {
  compact?: boolean;
  variant?: "header" | "toolbar" | "page";
}

export function ThemeToggle({ variant = "toolbar" }: Props) {
  const { mode, setMode } = useTheme();
  const { t } = useLocale();

  const LABEL: Record<ThemeMode, string> = {
    light: t("ui.themeStandard"),
    dark: t("ui.themeDark"),
    contrast: t("ui.themeContrast"),
    calm: t("ui.themeCalm"),
  };

  const label = `${t("ui.theme")}: ${LABEL[mode]}`;
  const isPage = variant === "page";

  return (
    <label className={isPage ? "wt-theme-toggle wt-theme-toggle--page" : "wt-theme-toggle"}>
      <span className="wt-sr-only">{label}</span>
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as ThemeMode)}
        aria-label={label}
        title={label}
        className={
          variant === "toolbar"
            ? "wt-toolbar-btn wt-theme-toggle__select wt-theme-toggle__select--toolbar"
            : "wt-theme-toggle__select"
        }
      >
        {THEME_MODES.map((id) => (
          <option key={id} value={id}>
            {`${ICON[id]} ${LABEL[id]}`}
          </option>
        ))}
      </select>
    </label>
  );
}
