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
  const [auditedOnly, setAuditedOnly] = useState(false);

  const statValues: Record<string, number> = {
    properties: propertyCount,
    facts: factCount,
    peers: peerCount,
  };

  return (
    <>
      {propertyCount > 0 && (
        <div style={{ position: "relative", marginBottom: 28 }}>
          <MapView focusPins={focusPins} auditedOnly={auditedOnly} />

          {/* Stats overlay — top-left of map */}
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              display: "flex",
              gap: 6,
              zIndex: 1000,
              pointerEvents: "none",
              flexWrap: "wrap",
            }}
          >
            {MAP_STATS.map(({ key, label }) => (
              <span
                key={key}
                style={{
                  background: "var(--wt-bg-elevated)",
                  border: "1px solid var(--wt-border)",
                  borderRadius: 999,
                  padding: "5px 11px",
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
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

          {/* Audited-only chip — top-right of map */}
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 1000,
            }}
          >
            <button
              type="button"
              onClick={() => setAuditedOnly((v) => !v)}
              style={{
                borderRadius: 999,
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid var(--wt-border)",
                background: auditedOnly ? "var(--wt-primary)" : "var(--wt-bg-elevated)",
                color: auditedOnly ? "var(--wt-primary-contrast)" : "var(--wt-text)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              Audited only
            </button>
          </div>
        </div>
      )}

      <SearchSection onResults={setFocusPins} />
    </>
  );
}
