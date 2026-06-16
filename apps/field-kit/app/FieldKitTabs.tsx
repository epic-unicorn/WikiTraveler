"use client";

import { useCallback, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { FieldKitToolbar } from "./FieldKitToolbar";
import { useNodeContext } from "./hooks/useNodeContext";
import { SearchTab } from "./tabs/SearchTab";
import { NearbyTab } from "./tabs/NearbyTab";
import { RecentTab } from "./tabs/RecentTab";
import { SettingsTab } from "./tabs/SettingsTab";

type TabId = "search" | "nearby" | "recent" | "settings";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: "search",
    label: "Search",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    id: "nearby",
    label: "Near me",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
  {
    id: "recent",
    label: "Recent",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function FieldKitTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("search");
  const {
    nodeUrl,
    searchNodeUrl,
    gpsResolved,
    nodeInfo,
    nodeReachable,
    setNodeUrl,
    resetNodeUrl,
  } = useNodeContext();

  const focusTab = useCallback((id: TabId) => {
    setActiveTab(id);
    document.getElementById(`tab-${id}`)?.focus();
  }, []);

  const handleTabKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, tabId: TabId) => {
      const idx = TABS.findIndex((t) => t.id === tabId);
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
    [focusTab]
  );

  return (
    <div className="fk-shell">
      <a href="#main-content" className="wt-skip-link">
        Skip to main content
      </a>
      <FieldKitToolbar
        nodeReachable={nodeReachable}
        end={
          <Link
            href="/properties/new"
            className="wt-toolbar-btn"
            title="Add new property"
            aria-label="Add new property"
          >
            <PlusIcon />
          </Link>
        }
      />
      <main
        id="main-content"
        className="page fk-main"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === "search" && (
          <SearchTab
            searchNodeUrl={searchNodeUrl}
            homeNodeUrl={nodeUrl}
            gpsResolved={gpsResolved}
          />
        )}
        {activeTab === "nearby" && (
          <NearbyTab
            searchNodeUrl={searchNodeUrl}
            homeNodeUrl={nodeUrl}
            active={activeTab === "nearby"}
          />
        )}
        {activeTab === "recent" && <RecentTab homeNodeUrl={nodeUrl} />}
        {activeTab === "settings" && (
          <SettingsTab
            nodeUrl={nodeUrl}
            nodeInfo={nodeInfo}
            nodeReachable={nodeReachable}
            onSaveNodeUrl={setNodeUrl}
            onResetNodeUrl={resetNodeUrl}
          />
        )}
      </main>

      <nav className="fk-tab-bar" role="tablist" aria-label="Field Kit sections">
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
            {tab.icon}
            <span className="fk-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
