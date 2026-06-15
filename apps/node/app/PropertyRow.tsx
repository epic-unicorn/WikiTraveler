"use client";

import { useState } from "react";
import Link from "next/link";

const TIER_COLOR: Record<string, string> = {
  OFFICIAL: "#9ca3af",
  AI_GUESS: "#fbbf24",
  VERIFIED: "#34d399",
  CONFIRMED: "#60a5fa",
};

const TIER_LABEL: Record<string, string> = {
  OFFICIAL: "Official",
  AI_GUESS: "AI Estimate",
  VERIFIED: "Verified",
  CONFIRMED: "Confirmed",
};

const SOURCE_COLOR: Record<string, string> = {
  AMADEUS: "#6366f1",
  WHEELMAP: "#0ea5e9",
  OSM: "#16a34a",
  WHEEL_THE_WORLD: "#f97316",
  AUDITOR: "#10b981",
};

const SOURCE_LABEL: Record<string, string> = {
  AMADEUS: "Amadeus",
  WHEELMAP: "Wheelmap",
  OSM: "OpenStreetMap",
  WHEEL_THE_WORLD: "WtW",
  AUDITOR: "Field Audit",
};

const TIER_RANK: Record<string, number> = {
  OFFICIAL: 0,
  AI_GUESS: 1,
  VERIFIED: 2,
  CONFIRMED: 3,
};

export interface PropertyRowData {
  id: string;
  name: string;
  location: string;
  facts: Array<{ id: string; fieldName: string; value: string; tier: string; sourceType: string }>;
}

export function PropertyRow({ property }: { property: PropertyRowData }) {
  const [open, setOpen] = useState(false);

  const best = new Map<string, { value: string; tier: string; sourceType: string }>();
  for (const f of property.facts) {
    const existing = best.get(f.fieldName);
    if (!existing || (TIER_RANK[f.tier] ?? 0) > (TIER_RANK[existing.tier] ?? 0)) {
      best.set(f.fieldName, { value: f.value, tier: f.tier, sourceType: f.sourceType });
    }
  }
  const displayFacts = Array.from(best.entries());
  const sources = Array.from(new Set(displayFacts.map(([, v]) => v.sourceType)));

  return (
    <div
      style={{
        background: "var(--wt-bg-elevated)",
        borderRadius: 12,
        border: "1px solid var(--wt-border)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={`property-facts-${property.id}`}
          style={{
            flex: 1,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
            color: "inherit",
            minWidth: 0,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontSize: 12,
              color: "var(--wt-text-muted)",
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
              flexShrink: 0,
            }}
          >
            ▶
          </span>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 15,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                margin: 0,
              }}
            >
              {property.name}
            </p>
            <p style={{ fontSize: 12, color: "var(--wt-text-muted)", marginTop: 1 }}>
              {property.location}
            </p>
          </div>

          <span
            style={{
              background: "var(--wt-bg-secondary)",
              color: "var(--wt-text)",
              borderRadius: 999,
              padding: "3px 10px",
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {displayFacts.length} facts
          </span>

          <div style={{ display: "flex", gap: 4, flexShrink: 0 }} aria-label="Data sources">
            {sources.map((s) => (
              <span
                key={s}
                style={{
                  background: SOURCE_COLOR[s] ?? "#9ca3af",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "3px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {SOURCE_LABEL[s] ?? s}
              </span>
            ))}
          </div>
        </button>

        <Link
          href={`/properties/${property.id}`}
          style={{
            display: "flex",
            alignItems: "center",
            background: "var(--wt-bg-header)",
            color: "var(--wt-bg-header-contrast)",
            borderRadius: 0,
            padding: "5px 14px",
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
            textDecoration: "none",
            borderLeft: "1px solid var(--wt-border)",
          }}
        >
          Audit
        </Link>
      </div>

      {open && (
        <div id={`property-facts-${property.id}`}>
          {displayFacts.length === 0 ? (
            <p
              style={{
                padding: "14px 20px",
                color: "var(--wt-text-muted)",
                fontSize: 13,
                borderTop: "1px solid var(--wt-border)",
                margin: 0,
              }}
            >
              No accessibility facts yet — be the first to audit.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 1,
                background: "var(--wt-border)",
                borderTop: "1px solid var(--wt-border)",
              }}
            >
              {displayFacts.map(([fieldName, { value, tier, sourceType }]) => (
                <div
                  key={fieldName}
                  style={{ background: "var(--wt-bg-elevated)", padding: "12px 16px" }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--wt-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: 4,
                    }}
                  >
                    {fieldName.replace(/_/g, " ")}
                  </p>
                  <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{value}</p>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <span
                      style={{
                        background: TIER_COLOR[tier] ?? "#9ca3af",
                        color: "#1e293b",
                        borderRadius: 999,
                        padding: "2px 8px",
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {TIER_LABEL[tier] ?? tier}
                    </span>
                    <span
                      style={{
                        background: SOURCE_COLOR[sourceType] ?? "#9ca3af",
                        color: "#fff",
                        borderRadius: 999,
                        padding: "2px 8px",
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {SOURCE_LABEL[sourceType] ?? sourceType}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
