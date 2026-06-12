"use client";

import { useState } from "react";
import { MapView, type MapPin } from "./MapView";
import { SearchSection } from "./SearchSection";

interface Props {
  propertyCount: number;
  factCount: number;
  peerCount: number;
}

const MAP_STATS = [
  { key: "properties", label: "Properties" },
  { key: "facts",      label: "Facts" },
  { key: "peers",      label: "Peers" },
] as const;

export function SearchMapLayout({ propertyCount, factCount, peerCount }: Props) {
  const [focusPins, setFocusPins] = useState<MapPin[] | null>(null);

  const statValues: Record<string, number> = {
    properties: propertyCount,
    facts: factCount,
    peers: peerCount,
  };

  return (
    <>
      {propertyCount > 0 && (
        <>
          {/* Stats row */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {MAP_STATS.map(({ key, label }) => (
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
                <span style={{ color: "var(--wt-text-muted)", fontSize: 11 }}>{label}</span>
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
