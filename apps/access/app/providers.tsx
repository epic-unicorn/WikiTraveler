"use client";

import { setupIonicReact, IonApp } from "@ionic/react";
import { ThemeProvider, LocaleProvider } from "@wikitraveler/ui";

setupIonicReact();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <IonApp className="wt-ion-web">{children}</IonApp>
      </LocaleProvider>
    </ThemeProvider>
  );
}
