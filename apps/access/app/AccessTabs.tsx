"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@wikitraveler/ui";
import { useNodeContext } from "./hooks/useNodeContext";
import { SearchTab } from "./tabs/SearchTab";
import { SavedTab } from "./tabs/SavedTab";
import { ContributeTab } from "./tabs/ContributeTab";
import { ProfileTab } from "./tabs/ProfileTab";
import { readAuthToken } from "./lib/authStorage";
import { canContribute, roleFromToken } from "./lib/userRole";
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
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  contribute: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
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
  const [role, setRole] = useState(() => roleFromToken(readAuthToken()));
  const contributor = canContribute(role);
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const tab = parseAccessTab(searchParams.get("tab"));
    return tab === "contribute" && !canContribute(roleFromToken(readAuthToken())) ? "profile" : tab;
  });
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
    const tab = parseAccessTab(searchParams.get("tab"));
    if (tab === "contribute" && !contributor) {
      setActiveTab("profile");
    } else {
      setActiveTab(tab);
    }
  }, [searchParams, contributor]);

  const TABS: { id: TabId; label: string }[] = useMemo(() => {
    const tabs: { id: TabId; label: string }[] = [
      { id: "search", label: t("ui.tabSearch") },
      { id: "saved", label: t("ui.tabSaved") },
    ];
    if (contributor) tabs.push({ id: "contribute", label: t("ui.tabContribute") });
    tabs.push({ id: "profile", label: t("ui.tabProfile") });
    return tabs;
  }, [t, contributor]);

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
          />
        </div>
        <div hidden={activeTab !== "saved"} className="fk-tab-panel">
          <SavedTab
            homeNodeUrl={nodeUrl}
            active={activeTab === "saved"}
            onAddLocation={() => setActiveTab("search")}
          />
        </div>
        {contributor && (
          <div hidden={activeTab !== "contribute"} className="fk-tab-panel">
            <ContributeTab homeNodeUrl={nodeUrl} />
          </div>
        )}
        <div hidden={activeTab !== "profile"} className="fk-tab-panel">
          <ProfileTab
            nodeUrl={nodeUrl}
            nodeInfo={nodeInfo}
            nodeReachable={nodeReachable}
            onSaveNodeUrl={setNodeUrl}
            onResetNodeUrl={resetNodeUrl}
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
            title={tab.label}
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
