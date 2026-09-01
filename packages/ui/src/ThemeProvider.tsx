"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { THEME_STORAGE_KEY, parseThemeMode, type ThemeMode } from "./constants";

const THEME_CLASSES = ["wt-dark", "wt-contrast", "wt-calm"] as const;

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const body = document.body;
  for (const cls of THEME_CLASSES) root.classList.remove(cls);
  root.classList.remove("ion-palette-dark");
  body.classList.remove("ion-palette-dark");
  root.dataset.theme = mode;

  if (mode === "dark") {
    root.classList.add("wt-dark");
    root.classList.add("ion-palette-dark");
    body.classList.add("ion-palette-dark");
  } else if (mode === "contrast") {
    root.classList.add("wt-contrast");
  } else if (mode === "calm") {
    root.classList.add("wt-calm");
  }
}

export { applyTheme };

export function ThemeProvider({
  children,
  onPersist,
}: {
  children: React.ReactNode;
  onPersist?: (mode: ThemeMode) => void;
}) {
  const [mode, setModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    const initial = parseThemeMode(localStorage.getItem(THEME_STORAGE_KEY));
    setModeState(initial);
    applyTheme(initial);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    onPersist?.(next);
    setModeState(next);
    applyTheme(next);
  }, [onPersist]);

  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  setMode: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}
