"use client";

import { ThemeProvider } from "@wikitraveler/ui";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
