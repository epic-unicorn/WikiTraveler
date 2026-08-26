"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@wikitraveler/ui";
import { AccessToolbar } from "./AccessToolbar";
import { useNodeContext } from "./hooks/useNodeContext";
import { SearchTab } from "./tabs/SearchTab";
import { NearbyTab } from "./tabs/NearbyTab";
import { SavedTab } from "./tabs/SavedTab";
import { ContributeTab } from "./tabs/ContributeTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { readAuthToken } from "./lib/authStorage";
import { roleFromToken, canContribute } from "./lib/userRole";
import { parseAccessTab, type AccessTabId } from "./lib/navigationReturn";

type TabId = AccessTabId;

const TAB_ICONS: Record<TabId, React.ReactNode> = {
  search: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  nearby: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  saved: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  contribute: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
    </svg>
  ),
  settings: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
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

  const contributor = canContribute(role);

  useEffect(() => {
    const next = parseAccessTab(searchParams.get("tab"));
    if (next === "contribute" && !contributor) return;
    setActiveTab(next);
  }, [contributor, searchParams]);

  const TABS: { id: TabId; label: string }[] = useMemo(
    () => [
      { id: "search", label: t("ui.tabSearch") },
      { id: "nearby", label: t("ui.tabNearby") },
      { id: "saved", label: t("ui.tabSaved") },
      ...(contributor ? [{ id: "contribute" as const, label: t("ui.tabContribute") }] : []),
      { id: "settings", label: t("ui.tabSettings") },
    ],
    [contributor, t]
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
      <AccessToolbar
        nodeReachable={nodeReachable}
        nodeRegion={nodeInfo?.region}
      />
      <main
        id="main-content"
        className="page fk-main"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`tab-${activeTab}`}
      >
        <div hidden={activeTab !== "search"}>
          <SearchTab
            dataNodeUrl={dataNodeUrl}
            homeNodeUrl={nodeUrl}
            dataRegion={dataRegion}
            regionLabel={nodeInfo?.region}
          />
        </div>
        <div hidden={activeTab !== "nearby"}>
          <NearbyTab
            searchNodeUrl={dataNodeUrl}
            homeNodeUrl={nodeUrl}
            active={activeTab === "nearby"}
          />
        </div>
        <div hidden={activeTab !== "saved"}>
          <SavedTab homeNodeUrl={nodeUrl} active={activeTab === "saved"} />
        </div>
        {contributor && (
          <div hidden={activeTab !== "contribute"}>
            <ContributeTab homeNodeUrl={nodeUrl} />
          </div>
        )}
        <div hidden={activeTab !== "settings"}>
          <SettingsTab
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
