"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@wikitraveler/ui";
import { fetchMySignals } from "../lib/accessApi";
import { propertyHref } from "../lib/propertyHref";
import {
  readDismissedNotificationIds,
  dismissNotification,
} from "../lib/notifications";

interface Props {
  homeNodeUrl: string;
}

export function NotificationList({ homeNodeUrl }: Props) {
  const { t } = useLocale();
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof fetchMySignals>>["signals"]
  >([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDismissed(readDismissedNotificationIds());
    let cancelled = false;
    setLoading(true);
    fetchMySignals(homeNodeUrl)
      .then((d) => {
        if (!cancelled) {
          setItems(
            d.signals.filter((s) => s.status === "RESOLVED" || s.status === "DISMISSED")
          );
        }
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [homeNodeUrl]);

  const visible = items.filter((s) => !dismissed.has(s.id));

  return (
    <div id="access-notifications">
      <p className="fk-section-header fk-section-header--compact">{t("ui.notificationsTitle")}</p>
      <div className="card fk-settings-card">
        {loading && <p className="status-muted">{t("ui.loading")}</p>}
        {!loading && visible.length === 0 && (
          <p className="fk-settings-theme-hint">{t("ui.notificationsEmpty")}</p>
        )}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {visible.map((s) => (
            <li
              key={s.id}
              style={{
                padding: "10px 12px",
                border: "1px solid var(--wt-border)",
                borderRadius: 10,
              }}
            >
              <Link
                href={propertyHref(s.property.id, homeNodeUrl, homeNodeUrl)}
                style={{ fontWeight: 600, fontSize: 13, color: "var(--wt-primary)", textDecoration: "none" }}
              >
                {s.property.name}
              </Link>
              <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                {t("ui.notificationReportHandled", {
                  type: t(`ui.signalType${s.type}`),
                  status: t(`ui.signalsStatus${s.status}`),
                })}
              </p>
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: 8, fontSize: 12, padding: "4px 10px" }}
                onClick={() => {
                  dismissNotification(s.id);
                  setDismissed(readDismissedNotificationIds());
                }}
              >
                {t("ui.notificationDismiss")}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
