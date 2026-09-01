"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "@wikitraveler/ui";
import { useNotificationBadgeCount } from "../hooks/useNotificationBadgeCount";
import { NotificationList } from "./NotificationList";

interface Props {
  homeNodeUrl: string;
}

export function NotificationBell({ homeNodeUrl }: Props) {
  const { t } = useLocale();
  const count = useNotificationBadgeCount(homeNodeUrl, true);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popupId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="fk-notify" ref={wrapRef}>
      <button
        type="button"
        className="fk-hero-notify-btn"
        aria-expanded={open}
        aria-controls={popupId}
        onClick={() => setOpen((v) => !v)}
        aria-label={
          count > 0
            ? t("ui.notificationsBadge", { count })
            : t("ui.notificationsTitle")
        }
        title={t("ui.notificationsTitle")}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="fk-hero-notify-badge" aria-hidden="true">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div id={popupId} className="fk-notify-panel" role="dialog" aria-label={t("ui.notificationsTitle")}>
          <NotificationList homeNodeUrl={homeNodeUrl} embedded />
        </div>
      )}
    </div>
  );
}
