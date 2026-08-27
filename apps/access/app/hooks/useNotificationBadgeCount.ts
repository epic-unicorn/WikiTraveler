"use client";

import { useEffect, useState } from "react";
import { fetchMySignals } from "../lib/accessApi";
import { readDismissedNotificationIds } from "../lib/notifications";

/** Undismissed resolved/dismissed signal updates (same as Profile notification list). */
export function useNotificationBadgeCount(homeNodeUrl: string, active = true): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active || !homeNodeUrl) {
      setCount(0);
      return;
    }
    let cancelled = false;
    fetchMySignals(homeNodeUrl)
      .then((d) => {
        if (cancelled) return;
        const dismissed = readDismissedNotificationIds();
        const n = d.signals.filter(
          (s) =>
            (s.status === "RESOLVED" || s.status === "DISMISSED") && !dismissed.has(s.id)
        ).length;
        setCount(n);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [homeNodeUrl, active]);

  return count;
}
