"use client";

import { ThemeProvider, LocaleProvider } from "@wikitraveler/ui";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LocaleProvider>{children}</LocaleProvider>
    </ThemeProvider>
  );
}
