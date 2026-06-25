"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@wikitraveler/ui";
import { readSavedPlaces, removeSavedPlace } from "../lib/savedPlaces";
import { propertyHref } from "../lib/propertyHref";
import { fetchMySignals, fetchContributorStats } from "../lib/accessApi";
import { RecentPropertiesSection } from "../components/RecentPropertiesSection";
import { readRecentAudits } from "../lib/recentAudits";

interface Props {
  homeNodeUrl: string;
  active?: boolean;
}

export function SavedTab({ homeNodeUrl, active = true }: Props) {
  const { t } = useLocale();
  const [saved, setSaved] = useState(() => readSavedPlaces());
  const [signals, setSignals] = useState<
    Awaited<ReturnType<typeof fetchMySignals>>["signals"]
  >([]);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const recentCount = readRecentAudits().length;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setSignalsLoading(true);
    fetchMySignals(homeNodeUrl)
      .then((d) => {
        if (!cancelled) setSignals(d.signals);
      })
      .catch(() => {
        if (!cancelled) setSignals([]);
      })
      .finally(() => {
        if (!cancelled) setSignalsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, homeNodeUrl]);

  return (
    <div className="tab-content" style={{ paddingTop: 16 }}>
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>{t("ui.savedTitle")}</h2>
        {saved.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--wt-text-muted)" }}>{t("ui.savedEmpty")}</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {saved.map((p) => (
              <li key={p.id}>
                <Link
                  href={propertyHref(p.id, p.nodeUrl, homeNodeUrl)}
                  style={{
                    display: "block",
                    padding: "12px 14px",
                    border: "1px solid var(--wt-border)",
                    borderRadius: 10,
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <strong style={{ fontSize: 14 }}>{p.name}</strong>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--wt-text-muted)" }}>{p.location}</p>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    removeSavedPlace(p.id);
                    setSaved(readSavedPlaces());
                  }}
                  style={{
                    marginTop: 4,
                    background: "none",
                    border: "none",
                    fontSize: 11,
                    color: "var(--wt-danger)",
                    cursor: "pointer",
                  }}
                >
                  {t("ui.savedRemove")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>{t("ui.myReportsTitle")}</h2>
        {signalsLoading && <p className="status-muted">{t("ui.loading")}</p>}
        {!signalsLoading && signals.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--wt-text-muted)" }}>{t("ui.myReportsEmpty")}</p>
        )}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {signals.map((s) => (
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
                {t(`ui.signalType${s.type}`)} · {t(`ui.signalsStatus${s.status}`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {recentCount > 0 && (
        <section>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>{t("ui.tabRecent")}</h2>
          <RecentPropertiesSection homeNodeUrl={homeNodeUrl} compact maxItems={5} />
        </section>
      )}
    </div>
  );
}
