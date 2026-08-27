"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ThemeToggle, LocalePicker, useLocale } from "@wikitraveler/ui";
import { DISPLAY_ENV_NODE_URL, toDisplayNodeUrl } from "../lib/accessApi";
import { clearAuth } from "../lib/authStorage";
import { AccessAccountBadge } from "../AccessAccountBadge";
import { useUpgradeHints } from "../hooks/useUpgradeHints";
import { canContribute } from "../lib/userRole";
import type { AppRole } from "../lib/authStorage";
import { AccessibilityPreferencesEditor } from "../components/AccessibilityPreferencesEditor";
import { NotificationList } from "../components/NotificationList";
import { RecentPropertiesSection } from "../components/RecentPropertiesSection";
import { readRecentAudits } from "../lib/recentAudits";
import { AccessPageHero } from "../components/AccessPageHero";
import { useNotificationBadgeCount } from "../hooks/useNotificationBadgeCount";

interface Props {
  nodeUrl: string;
  nodeInfo: { nodeId?: string; region?: string; version?: string } | null;
  nodeReachable: boolean | null;
  onSaveNodeUrl: (url: string) => void;
  onResetNodeUrl: () => void;
  role: AppRole;
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
  role,
}: Props) {
  const { t } = useLocale();
  const { clientVersion, hints } = useUpgradeHints(nodeInfo?.version);
  const notificationCount = useNotificationBadgeCount(nodeUrl, true);
  const [settingsUrl, setSettingsUrl] = useState(() => toDisplayNodeUrl(nodeUrl));
  const [settingsError, setSettingsError] = useState("");
  const contributor = canContribute(role);
  const recentCount = readRecentAudits().length;

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
        sectionTitle={t("ui.profileTitle")}
        sectionSubtitle={t("ui.profileSubtitle")}
        trailing={
          <button
            type="button"
            className="fk-hero-notify-btn"
            onClick={() => {
              document.getElementById("access-notifications")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            aria-label={
              notificationCount > 0
                ? t("ui.notificationsBadge", { count: notificationCount })
                : t("ui.notificationsTitle")
            }
            title={t("ui.notificationsTitle")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notificationCount > 0 && (
              <span className="fk-hero-notify-badge" aria-hidden="true">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </button>
        }
      />

      <div className="fk-page-body">
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

      <p className="fk-section-header fk-section-header--compact">{t("ui.a11yPreferencesTitle")}</p>
      <div className="card fk-settings-card">
        <AccessibilityPreferencesEditor />
      </div>

      <NotificationList homeNodeUrl={nodeUrl} />

      {contributor && (
        <>
          <p className="fk-section-header fk-section-header--compact">{t("ui.profileContribute")}</p>
          <div className="card fk-settings-card">
            <p className="fk-settings-theme-hint">{t("ui.profileAddPropertyHint")}</p>
            <Link href="/properties/new" className="btn-primary">
              {t("ui.addProperty")}
            </Link>
          </div>
          {recentCount > 0 && (
            <div style={{ marginTop: 16 }}>
              <p className="fk-section-header fk-section-header--compact">{t("ui.tabRecent")}</p>
              <RecentPropertiesSection homeNodeUrl={nodeUrl} compact maxItems={5} />
            </div>
          )}
        </>
      )}

      <p className="fk-section-header fk-section-header--compact">{t("ui.settingsNodeConnection")}</p>
      <div className="card fk-settings-card">
        <div className="fk-settings-status">
          {nodeInfo && nodeReachable ? (
            <>
              <span className="fk-chip fk-chip--ok"><CheckIcon /> {t("ui.connected")}</span>
              <span className="fk-settings-meta">
                {t("ui.settingsNodeVersion", { version: nodeInfo.version ?? "?" })}
              </span>
            </>
          ) : nodeReachable === false ? (
            <span className="fk-chip fk-chip--err"><XIcon /> {t("ui.unreachable")}</span>
          ) : (
            <span className="fk-chip fk-chip--neutral">{t("ui.checking")}</span>
          )}
        </div>

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
      </div>

      <details className="fk-settings-advanced">
        <summary className="fk-settings-advanced__summary">{t("ui.settingsAdvanced")}</summary>
        <div className="card fk-settings-card">
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
      </details>

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
      </div>
    </div>
  );
}
