"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "@wikitraveler/ui";
import { AdminPanel } from "./AdminPanel";
import { RegionPanel } from "./RegionPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { StatsPanel } from "./StatsPanel";
import { UsersPanel } from "./UsersPanel";
import { PeersPanel } from "./PeersPanel";

const STORAGE_KEY = "wt_node_token";
const TAB_KEY = "wt_admin_tab";

type AdminTab = "region" | "properties" | "stats" | "users" | "peers" | "backup";

const TAB_ORDER: AdminTab[] = ["region", "properties", "stats", "users", "peers", "backup"];

function decodeJwtRole(token: string): string | null {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return (payload.role as string | undefined)?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}

export function AdminSection() {
  const { t } = useLocale();
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<AdminTab>("region");

  useEffect(() => {
    let stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const m = document.cookie.match(/(?:^|;\s*)wt_token=([^;]+)/);
      if (m) {
        stored = decodeURIComponent(m[1]);
        if (stored) sessionStorage.setItem(STORAGE_KEY, stored);
      }
    }
    setToken(stored);
    const savedTab = sessionStorage.getItem(TAB_KEY);
    if (savedTab && TAB_ORDER.includes(savedTab as AdminTab)) {
      setTab(savedTab as AdminTab);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam && TAB_ORDER.includes(tabParam as AdminTab)) {
      setTab(tabParam as AdminTab);
      sessionStorage.setItem(TAB_KEY, tabParam);
    }
  }, []);

  function selectTab(next: AdminTab) {
    setTab(next);
    sessionStorage.setItem(TAB_KEY, next);
  }

  if (!loaded) return null;
  if (!token) return null;

  const role = decodeJwtRole(token);
  if (role !== "ADMIN") {
    return (
      <div className="wt-admin-panel">
        <p className="wt-admin-muted">{t("ui.adminRequired", { role: role ?? "USER" })}</p>
      </div>
    );
  }

  const tabLabels: Record<AdminTab, string> = {
    region: t("ui.adminTabRegion"),
    properties: t("ui.adminTabProperties"),
    stats: t("ui.adminTabStats"),
    users: t("ui.adminTabUsers"),
    peers: t("ui.adminTabPeers"),
    backup: t("ui.adminTabBackup"),
  };

  let panel: ReactNode;
  switch (tab) {
    case "region":
      panel = <RegionPanel token={token} />;
      break;
    case "properties":
      panel = <PropertiesPanel token={token} />;
      break;
    case "stats":
      panel = <StatsPanel token={token} />;
      break;
    case "users":
      panel = <UsersPanel token={token} />;
      break;
    case "peers":
      panel = <PeersPanel token={token} />;
      break;
    case "backup":
      panel = <AdminPanel token={token} />;
      break;
  }

  return (
    <div className="wt-dashboard-admin">
      <nav className="wt-admin-tabs" aria-label={t("ui.adminNavLabel")}>
        {TAB_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={`wt-admin-tab${tab === id ? " wt-admin-tab--active" : ""}`}
            onClick={() => selectTab(id)}
            aria-selected={tab === id}
          >
            {tabLabels[id]}
          </button>
        ))}
      </nav>
      <div className="wt-dashboard-admin__full">{panel}</div>
    </div>
  );
}
