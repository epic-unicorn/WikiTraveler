import {
  applyTheme,
  parseThemeMode,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "@wikitraveler/ui";
import { readAuthToken } from "./authStorage";
import { readUserScoped, writeUserScoped } from "./userScopedStorage";

const SCOPED_KEY = "wt_access_theme";
export const DEFAULT_ACCESS_THEME: ThemeMode = "light";

function isThemeMode(value: unknown): value is ThemeMode {
  return (
    value === "light" ||
    value === "dark" ||
    value === "contrast" ||
    value === "calm"
  );
}

/** Signed-in travelers: per-account theme. Guests (login/register): standard light. */
export function readAccessThemePreference(): ThemeMode {
  if (!readAuthToken()) return DEFAULT_ACCESS_THEME;

  const scoped = readUserScoped<ThemeMode>(SCOPED_KEY, DEFAULT_ACCESS_THEME, isThemeMode);
  if (scoped !== DEFAULT_ACCESS_THEME) return scoped;

  if (typeof localStorage === "undefined") return DEFAULT_ACCESS_THEME;
  const legacy = parseThemeMode(localStorage.getItem(THEME_STORAGE_KEY));
  if (legacy !== DEFAULT_ACCESS_THEME) {
    writeAccessThemePreference(legacy);
    return legacy;
  }
  return DEFAULT_ACCESS_THEME;
}

export function writeAccessThemePreference(mode: ThemeMode, opts?: { skipSync?: boolean }): void {
  if (readAuthToken()) {
    writeUserScoped(SCOPED_KEY, mode);
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }
  if (!opts?.skipSync && readAuthToken()) {
    void import("./profileSync").then((m) => m.schedulePreferencesPush());
  }
}

export function resetAccessThemeForLogin(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_STORAGE_KEY, DEFAULT_ACCESS_THEME);
  applyTheme(DEFAULT_ACCESS_THEME);
}

export function syncAccessTheme(setMode: (mode: ThemeMode) => void): void {
  if (readAuthToken()) {
    setMode(readAccessThemePreference());
    return;
  }
  resetAccessThemeForLogin();
  setMode(DEFAULT_ACCESS_THEME);
}
