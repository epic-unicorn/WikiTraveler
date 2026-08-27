"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@wikitraveler/ui";
import { useNodeContext } from "./hooks/useNodeContext";
import { SearchTab } from "./tabs/SearchTab";
import { SavedTab } from "./tabs/SavedTab";
import { ProfileTab } from "./tabs/ProfileTab";
import { readAuthToken } from "./lib/authStorage";
import { roleFromToken } from "./lib/userRole";
import { parseAccessTab, type AccessTabId } from "./lib/navigationReturn";
import { OnboardingOverlay } from "./components/OnboardingOverlay";

type TabId = AccessTabId;

const TAB_ICONS: Record<TabId, React.ReactNode> = {
  search: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  saved: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  profile: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
};

export function AccessTabs() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(() => parseAccessTab(searchParams.get("tab")));
  const [role, setRole] = useState(() => roleFromToken(readAuthToken()));
  const {
    nodeUrl,
    dataNodeUrl,
    dataRegion,
    nodeInfo,
    nodeReachable,
    setNodeUrl,
    resetNodeUrl,
  } = useNodeContext();

  useEffect(() => {
    setRole(roleFromToken(readAuthToken()));
  }, []);

  useEffect(() => {
    setActiveTab(parseAccessTab(searchParams.get("tab")));
  }, [searchParams]);

  const TABS: { id: TabId; label: string }[] = useMemo(
    () => [
      { id: "search", label: t("ui.tabSearch") },
      { id: "saved", label: t("ui.tabSaved") },
      { id: "profile", label: t("ui.tabProfile") },
    ],
    [t]
  );

  const focusTab = useCallback((id: TabId) => {
    setActiveTab(id);
    document.getElementById(`tab-${id}`)?.focus();
  }, []);

  const handleTabKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, tabId: TabId) => {
      const idx = TABS.findIndex((tab) => tab.id === tabId);
      if (idx < 0) return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        focusTab(TABS[(idx + 1) % TABS.length].id);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        focusTab(TABS[(idx - 1 + TABS.length) % TABS.length].id);
      } else if (e.key === "Home") {
        e.preventDefault();
        focusTab(TABS[0].id);
      } else if (e.key === "End") {
        e.preventDefault();
        focusTab(TABS[TABS.length - 1].id);
      }
    },
    [focusTab, TABS]
  );

  return (
    <div className="fk-shell">
      <a href="#main-content" className="wt-skip-link">
        {t("ui.skipToContent")}
      </a>
      <OnboardingOverlay />
      <main
        id="main-content"
        className={`page fk-main fk-main--flush${activeTab === "search" ? " fk-main--fill" : ""}`}
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`tab-${activeTab}`}
      >
        <div
          hidden={activeTab !== "search"}
          className={activeTab === "search" ? "fk-tab-panel fk-tab-panel--fill" : "fk-tab-panel"}
        >
          <SearchTab
            dataNodeUrl={dataNodeUrl}
            homeNodeUrl={nodeUrl}
            dataRegion={dataRegion}
            active={activeTab === "search"}
            onOpenProfile={() => {
              setActiveTab("profile");
              window.setTimeout(() => {
                document.getElementById("access-notifications")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }, 80);
            }}
          />
        </div>
        <div hidden={activeTab !== "saved"} className="fk-tab-panel">
          <SavedTab homeNodeUrl={nodeUrl} active={activeTab === "saved"} />
        </div>
        <div hidden={activeTab !== "profile"} className="fk-tab-panel">
          <ProfileTab
            nodeUrl={nodeUrl}
            nodeInfo={nodeInfo}
            nodeReachable={nodeReachable}
            onSaveNodeUrl={setNodeUrl}
            onResetNodeUrl={resetNodeUrl}
            role={role}
          />
        </div>
      </main>

      <nav className="fk-tab-bar" role="tablist" aria-label={t("ui.tabSections")}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls="main-content"
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`fk-tab-btn${activeTab === tab.id ? " fk-tab-btn--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
          >
            {TAB_ICONS[tab.id]}
            <span className="fk-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
