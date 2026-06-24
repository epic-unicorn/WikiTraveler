"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@wikitraveler/ui";
import { SignalsPanel } from "../SignalsPanel";
import { roleFromToken } from "@/lib/userRole";
import { decodeAuthCookie } from "@/lib/authCookie";

const STORAGE_KEY = "wt_node_token";

export function SignalsPageContent() {
  const { t } = useLocale();
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const m = document.cookie.match(/(?:^|;\s*)wt_token=([^;]+)/);
      if (m) {
        stored = decodeAuthCookie(m[1]);
        if (stored) sessionStorage.setItem(STORAGE_KEY, stored);
      }
    }
    setToken(stored);
    setRole(stored ? roleFromToken(stored) : null);
    setLoaded(true);
  }, []);

  if (!loaded) {
    return <p style={{ color: "var(--wt-text-muted)", fontSize: 14 }}>{t("ui.loading")}</p>;
  }

  if (!token || (role !== "AUDITOR" && role !== "ADMIN")) {
    return (
      <div
        style={{
          background: "var(--wt-bg-elevated)",
          border: "1px solid var(--wt-border)",
          borderRadius: 12,
          padding: 24,
        }}
        role="alert"
      >
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>{t("ui.authRoleRequired")}</h2>
        <p style={{ fontSize: 13, color: "var(--wt-text-muted)", margin: 0 }}>{t("ui.signalsContributorHint")}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "var(--wt-text)" }}>
        {t("ui.signalsPanelTitle")}
      </h2>
      <p style={{ fontSize: 13, color: "var(--wt-text-muted)", margin: "0 0 20px" }}>
        {t("ui.signalsContributorHint")}
      </p>
      <SignalsPanel token={token} showTitle={false} />
    </div>
  );
}
