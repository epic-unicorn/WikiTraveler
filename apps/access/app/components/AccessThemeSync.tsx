"use client";

import { useEffect } from "react";
import { useTheme } from "@wikitraveler/ui";
import { AUTH_CHANGED_EVENT } from "../lib/authStorage";
import { syncAccessTheme, writeAccessThemePreference } from "../lib/themePreference";

/** Keep theme per signed-in user; login/register always use the standard theme. */
export function AccessThemeSync() {
  const { setMode } = useTheme();

  useEffect(() => {
    syncAccessTheme(setMode);

    const onAuthChange = () => syncAccessTheme(setMode);
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChange);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChange);
  }, [setMode]);

  return null;
}

export function persistAccessTheme(mode: Parameters<typeof writeAccessThemePreference>[0]) {
  writeAccessThemePreference(mode);
}
