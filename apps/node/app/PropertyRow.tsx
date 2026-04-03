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
  WHEELMAP: "Wheelmap ♿",
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

  // Collapse to highest tier per field
  const best = new Map<string, { value: string; tier: string; sourceType: string }>();
  for (const f of property.facts) {
    const existing = best.get(f.fieldName);
    if (!existing || (TIER_RANK[f.tier] ?? 0) > (TIER_RANK[existing.tier] ?? 0)) {
      best.set(f.fieldName, { value: f.value, tier: f.tier, sourceType: f.sourceType });
    }
  }
  const displayFacts = Array.from(best.entries());

  // Unique sources for the summary row
  const sources = Array.from(new Set(displayFacts.map(([, v]) => v.sourceType)));

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
      }}
    >
      {/* ── Collapsed header row ── */}
      <div
        style={{
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
      >
        {/* Chevron */}
        <span
          style={{
            fontSize: 12,
            color: "#9ca3af",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
            flexShrink: 0,
          }}
        >
          ▶
        </span>

        {/* Name + location */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {property.name}
          </p>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>
            📍 {property.location}
          </p>
        </div>

        {/* Fact count */}
        <span
          style={{
            background: "#f3f4f6",
            color: "#374151",
            borderRadius: 999,
            padding: "3px 10px",
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {displayFacts.length} facts
        </span>

        {/* Source badges */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
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

        {/* Audit link — stop propagation so click doesn't toggle row */}
        <Link
          href={`/properties/${property.id}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#1e3a5f",
            color: "#fff",
            borderRadius: 8,
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 500,
            flexShrink: 0,
            textDecoration: "none",
          }}
        >
          Audit →
        </Link>
      </div>

      {/* ── Expanded facts grid ── */}
      {open && (
        <>
          {displayFacts.length === 0 ? (
            <p
              style={{
                padding: "14px 20px",
                color: "#9ca3af",
                fontSize: 13,
                borderTop: "1px solid #f3f4f6",
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
                background: "#f3f4f6",
                borderTop: "1px solid #f3f4f6",
              }}
            >
              {displayFacts.map(([fieldName, { value, tier, sourceType }]) => (
                <div
                  key={fieldName}
                  style={{ background: "#fff", padding: "12px 16px" }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: 4,
                    }}
                  >
                    {fieldName.replace(/_/g, " ")}
                  </p>
                  <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
                    {value}
                  </p>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <span
                      style={{
                        background: TIER_COLOR[tier] ?? "#9ca3af",
                        color: "#fff",
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
        </>
      )}
    </div>
  );
}
