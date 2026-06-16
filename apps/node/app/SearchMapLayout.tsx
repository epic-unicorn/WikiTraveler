"use client";

import { useState } from "react";
import { useLocale } from "@wikitraveler/ui";
import { MapView, type MapPin } from "./MapView";
import { SearchSection } from "./SearchSection";

interface Props {
  propertyCount: number;
  factCount: number;
  peerCount: number;
}

const MAP_STAT_KEYS = ["properties", "facts", "peers"] as const;

export function SearchMapLayout({ propertyCount, factCount, peerCount }: Props) {
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
      {propertyCount > 0 && (
        <>
          {/* Stats row */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
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

          <div style={{ marginBottom: 28 }}>
            <MapView focusPins={focusPins} />
          </div>
        </>
      )}

      <SearchSection onResults={setFocusPins} />
    </>
  );
}
