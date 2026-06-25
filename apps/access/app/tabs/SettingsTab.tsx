"use client";

import { useState, useEffect } from "react";
import { ThemeToggle, LocalePicker, useLocale } from "@wikitraveler/ui";
import { DISPLAY_ENV_NODE_URL, toDisplayNodeUrl } from "../lib/accessApi";
import { clearAuth } from "../lib/authStorage";
import { AccessAccountBadge } from "../AccessAccountBadge";

interface Props {
  nodeUrl: string;
  nodeInfo: { nodeId?: string; region?: string; version?: string } | null;
  nodeReachable: boolean | null;
  onSaveNodeUrl: (url: string) => void;
  onResetNodeUrl: () => void;
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
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
  const [settingsUrl, setSettingsUrl] = useState(() => toDisplayNodeUrl(nodeUrl));
  const [settingsError, setSettingsError] = useState("");

  useEffect(() => {
    setSettingsUrl(toDisplayNodeUrl(nodeUrl));
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
    setSettingsUrl(DISPLAY_ENV_NODE_URL);
    onResetNodeUrl();
    setSettingsError("");
  }

  return (
    <div className="tab-content fk-settings-tab">
      <p className="fk-section-header fk-section-header--compact">{t("ui.settingsNodeConnection")}</p>
      <div className="card fk-settings-card">
        <div className="fk-settings-status">
          {nodeInfo && nodeReachable ? (
            <>
              <span className="fk-chip fk-chip--ok"><CheckIcon /> {t("ui.connected")}</span>
              <span className="fk-settings-meta">
                {nodeInfo.region ?? "Global"} · v{nodeInfo.version}
              </span>
            </>
          ) : nodeReachable === false ? (
            <span className="fk-chip fk-chip--err"><XIcon /> {t("ui.unreachable")}</span>
          ) : (
            <span className="fk-chip fk-chip--neutral">{t("ui.checking")}</span>
          )}
        </div>

        <label htmlFor="node-url" className="fk-settings-label">{t("ui.settingsHomeNodeUrl")}</label>
        <input
          id="node-url"
          type="url"
          className="fk-settings-input"
          value={settingsUrl}
          onChange={(e) => setSettingsUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="https://..."
        />

        {settingsError && <p className="status-err">{settingsError}</p>}

        <div className="fk-settings-actions">
          <button type="button" className="btn-primary fk-settings-save" onClick={save}>
            {t("ui.save")}
          </button>
          <button type="button" className="btn-secondary fk-settings-reset" onClick={reset}>
            {t("ui.reset")}
          </button>
        </div>
      </div>

      <p className="fk-section-header fk-section-header--compact">{t("ui.settingsLanguage")}</p>
      <div className="card fk-settings-card fk-settings-card--compact">
        <LocalePicker />
      </div>

      <p className="fk-section-header fk-section-header--compact">{t("ui.settingsAppearance")}</p>
      <div className="card fk-settings-card fk-settings-card--compact">
        <div className="fk-settings-theme-row">
          <div>
            <p className="fk-settings-theme-title">{t("ui.theme")}</p>
            <p className="fk-settings-theme-hint">{t("ui.settingsThemeHint")}</p>
          </div>
          <ThemeToggle compact variant="page" />
        </div>
      </div>

      <p className="fk-section-header fk-section-header--compact">{t("ui.settingsAccount")}</p>
      <div className="card fk-settings-card">
        <AccessAccountBadge compact={false} />
        <button
          type="button"
          className="btn-secondary fk-settings-signout"
          onClick={() => {
            clearAuth();
            window.location.href = "/login";
          }}
        >
          {t("ui.signOut")}
        </button>
      </div>
    </div>
  );
}
