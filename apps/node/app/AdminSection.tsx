"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@wikitraveler/ui";
import { AdminPanel } from "./AdminPanel";
import { UsersPanel } from "./UsersPanel";
import { PeersPanel } from "./PeersPanel";

const STORAGE_KEY = "wt_node_token";

/** Decode JWT payload (base64) without verification — display purposes only. */
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

/**
 * AdminSection — reads the app-level JWT from sessionStorage (or the login
 * cookie as fallback on page refresh), then shows the admin panels when the
 * token belongs to an ADMIN-role user.
 */
export function AdminSection() {
  const { t } = useLocale();
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Try sessionStorage first, then fall back to the app-level login cookie
    let stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const m = document.cookie.match(/(?:^|;\s*)wt_token=([^;]+)/);
      if (m) {
        stored = decodeURIComponent(m[1]);
        if (stored) sessionStorage.setItem(STORAGE_KEY, stored);
      }
    }
    setToken(stored);
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  if (!token) return null; // Middleware should have redirected; safety fallback.

  const role = decodeJwtRole(token);

  if (role !== "ADMIN") {
    return (
      <div style={{
        background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
        padding: "16px 24px", marginBottom: 24, fontSize: 13, color: "#6b7280",
      }}>
        {t("ui.adminRequired", { role: role ?? "USER" })}
      </div>
    );
  }

  return (
    <div>
      <AdminPanel token={token} />
      <PeersPanel token={token} />
      <UsersPanel token={token} />
    </div>
  );
}
