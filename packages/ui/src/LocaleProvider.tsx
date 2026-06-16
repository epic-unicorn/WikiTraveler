"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import {
  resolveLocale,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  type Locale,
  t,
  getFieldLabel,
  getTierLabel,
} from "@wikitraveler/i18n";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  getFieldLabel: (fieldName: string) => string;
  getTierLabel: (tier: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  return resolveLocale({
    stored: localStorage.getItem(LOCALE_STORAGE_KEY),
    acceptLanguage: navigator.language,
    nodeDefault: null,
  });
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Always start with the default so server HTML matches the first client render.
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const resolved = readStoredLocale();
    setLocaleState(resolved);
    document.documentElement.lang = resolved;
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>) => t(key, locale, params),
    [locale]
  );

  const value: LocaleContextValue = {
    locale,
    setLocale,
    t: translate,
    getFieldLabel: (fieldName) => getFieldLabel(fieldName, locale),
    getTierLabel: (tier) => getTierLabel(tier, locale),
  };

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

export { SUPPORTED_LOCALES, LOCALE_LABELS };
