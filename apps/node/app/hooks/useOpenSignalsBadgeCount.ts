"use client";

import { useCallback, useEffect, useState } from "react";
import { readNodeClientToken } from "@/lib/clientAuthToken";
import { canAccessDashboard, roleFromToken } from "@/lib/userRole";

const REFRESH_MS = 120_000;

export function useOpenSignalsBadgeCount(active = true): number {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (!active) {
      setCount(0);
      return;
    }

    const token = readNodeClientToken();
    if (!token || !canAccessDashboard(roleFromToken(token))) {
      setCount(0);
      return;
    }

    fetch("/api/admin/signals?countOnly=1", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { openCount?: number }) => {
        setCount(typeof data.openCount === "number" ? data.openCount : 0);
      })
      .catch(() => setCount(0));
  }, [active]);

  useEffect(() => {
    refresh();

    const onSignalsUpdated = () => refresh();
    window.addEventListener("wt-signals-updated", onSignalsUpdated);
    window.addEventListener("focus", onSignalsUpdated);

    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => {
      window.removeEventListener("wt-signals-updated", onSignalsUpdated);
      window.removeEventListener("focus", onSignalsUpdated);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return count;
}
