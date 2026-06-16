"use client";

import { useState, useEffect } from "react";
import { ThemeToggle, LocalePicker, useLocale } from "@wikitraveler/ui";
import { ENV_NODE_URL } from "../lib/fieldKitApi";
import { clearAuth } from "../lib/authStorage";

interface Props {
  nodeUrl: string;
  nodeInfo: { nodeId?: string; region?: string; version?: string } | null;
  nodeReachable: boolean | null;
  onSaveNodeUrl: (url: string) => void;
  onResetNodeUrl: () => void;
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

export function SettingsTab({
  nodeUrl,
  nodeInfo,
  nodeReachable,
  onSaveNodeUrl,
  onResetNodeUrl,
}: Props) {
  const { t } = useLocale();
  const [settingsUrl, setSettingsUrl] = useState(nodeUrl);
  const [settingsError, setSettingsError] = useState("");

  useEffect(() => {
    setSettingsUrl(nodeUrl);
  }, [nodeUrl]);

  function save() {
    const trimmed = settingsUrl.trim().replace(/\/$/, "");
    try {
      new URL(trimmed);
    } catch {
      setSettingsError(t("ui.settingsInvalidUrl"));
      return;
    }
    onSaveNodeUrl(trimmed);
    setSettingsError("");
  }

  function reset() {
    setSettingsUrl(ENV_NODE_URL);
    onResetNodeUrl();
    setSettingsError("");
  }

  return (
    <div className="tab-content" style={{ paddingTop: 4 }}>
      <p className="fk-section-header">{t("ui.settingsNodeConnection")}</p>
      <div className="card" style={{ marginTop: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          {nodeInfo && nodeReachable ? (
            <>
              <span className="fk-chip fk-chip--ok"><CheckIcon /> {t("ui.connected")}</span>
              <span style={{ fontSize: 12, color: "var(--wt-text-muted)" }}>
                {nodeInfo.region ?? "Global"} · v{nodeInfo.version}
              </span>
            </>
          ) : nodeReachable === false ? (
            <span className="fk-chip fk-chip--err"><XIcon /> {t("ui.unreachable")}</span>
          ) : (
            <span className="fk-chip fk-chip--neutral">{t("ui.checking")}</span>
          )}
        </div>

        <label htmlFor="node-url" style={{ marginTop: 0 }}>{t("ui.settingsHomeNodeUrl")}</label>
        <input
          id="node-url"
          type="url"
          value={settingsUrl}
          onChange={(e) => setSettingsUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="https://..."
        />

        {settingsError && <p className="status-err">{settingsError}</p>}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button type="button" className="btn-primary" style={{ flex: 2, minHeight: 46, marginTop: 0, fontSize: 15 }} onClick={save}>
            {t("ui.save")}
          </button>
          <button type="button" className="btn-secondary" style={{ flex: 1, minHeight: 46, marginTop: 0, fontSize: 14 }} onClick={reset}>
            {t("ui.reset")}
          </button>
        </div>
      </div>

      <p className="fk-section-header">{t("ui.settingsLanguage")}</p>
      <div className="card" style={{ marginTop: 0 }}>
        <LocalePicker />
      </div>

      <p className="fk-section-header">{t("ui.settingsAppearance")}</p>
      <div className="card" style={{ marginTop: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{t("ui.theme")}</p>
            <p style={{ fontSize: 13, color: "var(--wt-text-muted)" }}>{t("ui.settingsThemeHint")}</p>
          </div>
          <ThemeToggle compact variant="page" />
        </div>
      </div>

      <p className="fk-section-header">{t("ui.settingsAccount")}</p>
      <div className="card" style={{ marginTop: 0 }}>
        <button
          type="button"
          className="btn-secondary"
          style={{
            marginTop: 0,
            color: "var(--wt-danger)",
            borderColor: "color-mix(in srgb, var(--wt-danger) 35%, var(--wt-border))",
          }}
          onClick={() => {
            clearAuth();
            window.location.href = "/login";
          }}
        >
          {t("ui.signOut")}
        </button>
      </div>

      <div style={{ height: 8 }} />
    </div>
  );
}
