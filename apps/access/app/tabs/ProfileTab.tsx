"use client";

import { useState, useEffect } from "react";
import { ThemeToggle, LocalePicker, useLocale } from "@wikitraveler/ui";
import { DISPLAY_ENV_NODE_URL, toDisplayNodeUrl } from "../lib/accessApi";
import { clearAuth } from "../lib/authStorage";
import { AccessAccountBadge } from "../AccessAccountBadge";
import { useUpgradeHints } from "../hooks/useUpgradeHints";
import { AccessibilityPreferencesEditor } from "../components/AccessibilityPreferencesEditor";
import { AccessPageHero } from "../components/AccessPageHero";

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

export function ProfileTab({
  nodeUrl,
  nodeInfo,
  nodeReachable,
  onSaveNodeUrl,
  onResetNodeUrl,
}: Props) {
  const { t } = useLocale();
  const { clientVersion, hints } = useUpgradeHints(nodeInfo?.version);
  const [settingsUrl, setSettingsUrl] = useState(() => toDisplayNodeUrl(nodeUrl));
  const [settingsError, setSettingsError] = useState("");
  const [nodeOpen, setNodeOpen] = useState(false);

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
    <div className="tab-content fk-settings-tab fk-profile-tab">
      <AccessPageHero
        notifyNodeUrl={nodeUrl}
        identity={
          <AccessAccountBadge
            variant="hero"
            onSignOut={() => {
              clearAuth();
              window.location.href = "/login";
            }}
          />
        }
      />

      <div className="fk-page-body">
        <section className="card fk-settings-card fk-profile-block">
          <h2 className="fk-profile-block__title">
            <span className="fk-profile-block__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
            </span>
            {t("ui.a11yPreferencesTitle")}
          </h2>
          <AccessibilityPreferencesEditor summary />
        </section>

        <section className="card fk-settings-card fk-profile-block">
          <h2 className="fk-profile-block__title">
            <span className="fk-profile-block__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0 1 14.08 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/><path d="M2 8.82a16 16 0 0 1 20 0"/></svg>
            </span>
            {t("ui.settingsNodeConnection")}
          </h2>
          <button
            type="button"
            className="fk-node-row"
            onClick={() => setNodeOpen((v) => !v)}
            aria-expanded={nodeOpen}
          >
            <span className="fk-node-row__status">
              {nodeInfo && nodeReachable ? (
                <>
                  <span className="fk-settings-meta">
                    {t("ui.settingsNodeVersion", { version: nodeInfo.version ?? "?" })}
                  </span>
                  <span className="fk-chip fk-chip--ok"><CheckIcon /> {t("ui.connected")}</span>
                </>
              ) : nodeReachable === false ? (
                <span className="fk-chip fk-chip--err"><XIcon /> {t("ui.unreachable")}</span>
              ) : (
                <span className="fk-chip fk-chip--neutral">{t("ui.checking")}</span>
              )}
            </span>
            <svg className={`fk-chevron${nodeOpen ? " fk-chevron--open" : ""}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </button>
          {nodeOpen && (
            <div className="fk-node-advanced">
              <p className="fk-settings-theme-hint fk-settings-advanced__hint">
                {t("ui.settingsHomeNodeAdvancedHint")}
              </p>
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
          )}
        </section>

        <section className="card fk-settings-card fk-profile-block">
          <h2 className="fk-profile-block__title">
            <span className="fk-profile-block__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
            </span>
            {t("ui.settingsAccessApp")}
          </h2>
          <p className="fk-settings-version-row">
            {t("ui.settingsClientVersion", { version: clientVersion })}
          </p>
          {hints.map((hint, index) => (
            <p
              key={index}
              className={hint.level === "warn" ? "status-err fk-settings-hint" : "fk-settings-hint fk-settings-hint--info"}
              role="status"
            >
              {hint.message}
            </p>
          ))}
          <div className="fk-settings-theme-row fk-settings-theme-row--profile">
            <div>
              <p className="fk-settings-theme-title">{t("ui.theme")}</p>
              <p className="fk-settings-theme-hint">{t("ui.settingsThemeHint")}</p>
            </div>
            <ThemeToggle compact variant="page" />
          </div>
        </section>

        <section className="card fk-settings-card fk-profile-block fk-profile-block--settings">
          <h2 className="fk-profile-block__title">
            <span className="fk-profile-block__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            </span>
            {t("ui.tabSettings")}
          </h2>
          <div className="fk-settings-row">
            <span className="fk-settings-row__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>
            </span>
            <span className="fk-settings-row__label">{t("ui.language")}</span>
            <LocalePicker compact />
          </div>
        </section>
      </div>
    </div>
  );
}
