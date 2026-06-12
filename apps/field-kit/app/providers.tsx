"use client";

import { setupIonicReact, IonApp } from "@ionic/react";
import { ThemeProvider } from "@wikitraveler/ui";

setupIonicReact();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <IonApp className="wt-ion-web">{children}</IonApp>
    </ThemeProvider>
  );
}
