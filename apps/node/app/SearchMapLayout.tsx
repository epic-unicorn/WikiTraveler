"use client";

import { useState } from "react";
import { useLocale } from "@wikitraveler/ui";
import { MapView, type MapPin } from "./MapView";
import { SearchSection } from "./SearchSection";
import Link from "next/link";

interface Props {
  propertyCount: number;
  factCount: number;
  peerCount: number;
  regionConfigured: boolean;
}

const MAP_STAT_KEYS = ["properties", "facts", "peers"] as const;

export function SearchMapLayout({ propertyCount, factCount, peerCount, regionConfigured }: Props) {
  const { t } = useLocale();
  const [focusPins, setFocusPins] = useState<MapPin[] | null>(null);

  const statValues: Record<(typeof MAP_STAT_KEYS)[number], number> = {
    properties: propertyCount,
    facts: factCount,
    peers: peerCount,
  };

  const statLabels: Record<(typeof MAP_STAT_KEYS)[number], string> = {
    properties: t("ui.mapProperties"),
    facts: t("ui.mapFacts"),
    peers: t("ui.mapPeers"),
  };

  return (
    <>
      {!regionConfigured && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 14,
            color: "#92400e",
          }}
        >
          {t("ui.regionNotConfigured")}{" "}
          <Link href="/stats" style={{ color: "#b45309", fontWeight: 600 }}>
            {t("ui.regionConfigureLink")}
          </Link>
        </div>
      )}

      {propertyCount > 0 && (
        <div className="wt-stat-pills">
          {MAP_STAT_KEYS.map((key) => (
            <span
              key={key}
              style={{
                background: "var(--wt-bg-elevated)",
                border: "1px solid var(--wt-border)",
                borderRadius: 999,
                padding: "5px 12px",
                fontSize: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                color: "var(--wt-text)",
                whiteSpace: "nowrap",
              }}
            >
              <strong
                style={{
                  color: "var(--wt-primary)",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {statValues[key].toLocaleString()}
              </strong>
              <span style={{ color: "var(--wt-text-muted)", fontSize: 11 }}>{statLabels[key]}</span>
            </span>
          ))}
        </div>
      )}

      {regionConfigured && propertyCount === 0 && (
        <div
          style={{
            background: "var(--wt-bg-elevated)",
            border: "1px solid var(--wt-border)",
            borderRadius: 10,
            padding: "24px",
            marginBottom: 24,
            textAlign: "center",
            color: "var(--wt-text-muted)",
            fontSize: 14,
          }}
        >
          {t("ui.regionEmptyMap")}
        </div>
      )}

      {propertyCount > 0 ? (
        <div className="wt-dashboard-map">
          <div className="wt-dashboard-map__map">
            <MapView focusPins={focusPins} />
          </div>
          <div className="wt-dashboard-map__search">
            <SearchSection onResults={setFocusPins} />
          </div>
        </div>
      ) : (
        <SearchSection onResults={setFocusPins} />
      )}
    </>
  );
}
