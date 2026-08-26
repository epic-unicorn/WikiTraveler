"use client";

import { useEffect, useState } from "react";
import { setupIonicReact, IonApp } from "@ionic/react";
import { ThemeProvider, LocaleProvider } from "@wikitraveler/ui";

let ionicBootstrapped = false;

function ensureIonic() {
  if (ionicBootstrapped) return;
  setupIonicReact();
  ionicBootstrapped = true;
}

/**
 * Ionic upgrades `<ion-app>` with classes (`md`, `hydrated`, …) before React
 * hydrates, which mismatches SSR HTML. Render a plain shell until mount, then
 * swap to IonApp on the client only.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    ensureIonic();
    setMounted(true);
  }, []);

  return (
    <ThemeProvider>
      <LocaleProvider>
        {mounted ? (
          <IonApp className="wt-ion-web">{children}</IonApp>
        ) : (
          <div className="wt-ion-web">{children}</div>
        )}
      </LocaleProvider>
    </ThemeProvider>
  );
}
