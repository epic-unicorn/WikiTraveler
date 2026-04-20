"use client";

import { useState, useCallback, useTransition, useRef } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_COLOR: Record<string, string> = {
  OFFICIAL: "#9ca3af",
  AI_GUESS: "#fbbf24",
  VERIFIED: "#34d399",
  CONFIRMED: "#60a5fa",
};

const TIER_RANK: Record<string, number> = {
  OFFICIAL: 0,
  AI_GUESS: 1,
  VERIFIED: 2,
  CONFIRMED: 3,
};

const FEATURES: Array<{ key: string; label: string; emoji: string }> = [
  { key: "step_free_entrance", label: "Step-free entrance", emoji: "♿" },
  { key: "accessible_bathroom", label: "Accessible bathroom", emoji: "🚿" },
  { key: "ramp_present", label: "Ramp", emoji: "🔧" },
  { key: "hearing_loop", label: "Hearing loop", emoji: "🔊" },
  { key: "tactile_paving", label: "Tactile paving", emoji: "👣" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Fact {
  fieldName: string;
  value: string;
  tier: string;
  sourceType: string;
}

interface Property {
  id: string;
  name: string;
  location: string;
  canonicalId: string;
  lat: number | null;
  lon: number | null;
  facts: Fact[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  onResults?: (pins: Array<{ id: string; name: string; lat: number; lon: number }> | null) => void;
}

export function SearchSection({ onResults }: Props) {
  const [query, setQuery] = useState("");
  const [activeFeatures, setActiveFeatures] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Property[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (q: string, features: Set<string>) => {
      const hasInput = q.trim().length > 0 || features.size > 0;
      if (!hasInput) {
        setResults(null);
        onResults?.(null);
        return;
      }
      startTransition(async () => {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (features.size > 0) params.set("feature", Array.from(features).join(","));
        const res = await fetch(`/api/properties?${params}`);
        const data = await res.json() as { properties: Property[] };
        setResults(data.properties);
        onResults?.(
          data.properties
            .filter((p) => p.lat != null && p.lon != null)
            .map((p) => ({ id: p.id, name: p.name, lat: p.lat!, lon: p.lon! }))
        );
      });
    },
    [onResults]
  );

  const debouncedSearch = useCallback(
    (q: string, features: Set<string>) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => search(q, features), 300);
    },
    [search]
  );

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    debouncedSearch(q, activeFeatures);
  };

  const toggleFeature = (key: string) => {
    const next = new Set(activeFeatures);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setActiveFeatures(next);
    search(query, next); // feature toggles fire immediately
  };

  return (
    <div>
      {/* Search input */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="search"
          value={query}
          onChange={handleQueryChange}
          placeholder="Search by hotel name, street or city…"
          style={{
            width: "100%",
            padding: "12px 16px",
            fontSize: 16,
            border: "1.5px solid #d1d5db",
            borderRadius: 10,
            outline: "none",
            boxSizing: "border-box",
            background: "#fff",
          }}
        />
      </div>

      {/* Feature filter pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
        {FEATURES.map((f) => {
          const active = activeFeatures.has(f.key);
          return (
            <button
              key={f.key}
              onClick={() => toggleFeature(f.key)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: `1.5px solid ${active ? "#1e3a5f" : "#d1d5db"}`,
                background: active ? "#1e3a5f" : "#fff",
                color: active ? "#fff" : "#374151",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{f.emoji}</span>
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Results */}
      {isPending && (
        <p style={{ color: "#6b7280", fontSize: 14 }}>Searching…</p>
      )}

      {!isPending && results === null && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af" }}>
          <p style={{ fontSize: 48, marginBottom: 12 }}>🔍</p>
          <p style={{ fontSize: 16 }}>Search by name, city, or pick an accessibility feature above.</p>
        </div>
      )}

      {!isPending && results !== null && results.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af" }}>
          <p style={{ fontSize: 48, marginBottom: 12 }}>🏨</p>
          <p style={{ fontSize: 16 }}>No properties found. Try a different search.</p>
        </div>
      )}

      {!isPending && results !== null && results.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {results.map((p) => <ResultRow key={p.id} property={p} />)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result row
// ---------------------------------------------------------------------------

function ResultRow({ property }: { property: Property }) {
  const [open, setOpen] = useState(false);

  // Best fact per field
  const best = new Map<string, Fact>();
  for (const f of property.facts) {
    const existing = best.get(f.fieldName);
    if (!existing || (TIER_RANK[f.tier] ?? 0) > (TIER_RANK[existing.tier] ?? 0)) {
      best.set(f.fieldName, f);
    }
  }
  const displayFacts = Array.from(best.entries());

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
      }}
    >
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
        <span style={{ fontSize: 12, color: "#9ca3af", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>▶</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {property.name}
          </p>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>📍 {property.location}</p>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", flexShrink: 0 }}>
          {displayFacts.slice(0, 4).map(([field, fact]) => (
            <span
              key={field}
              style={{
                background: TIER_COLOR[fact.tier] ?? "#9ca3af",
                color: "#fff",
                borderRadius: 999,
                padding: "2px 10px",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {fieldLabel(field)}
            </span>
          ))}
          {displayFacts.length > 4 && (
            <span style={{ fontSize: 11, color: "#9ca3af", alignSelf: "center" }}>
              +{displayFacts.length - 4}
            </span>
          )}
        </div>

        <Link
          href={`/properties/${property.id}`}
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 12, color: "#1e3a5f", textDecoration: "none", flexShrink: 0, fontWeight: 600 }}
        >
          Audit →
        </Link>
      </div>

      {open && displayFacts.length > 0 && (
        <div style={{ borderTop: "1px solid #f3f4f6", padding: "12px 20px", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {displayFacts.map(([field, fact]) => (
            <div
              key={field}
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
              }}
            >
              <span style={{ color: "#6b7280" }}>{fieldLabel(field)}: </span>
              <span style={{ fontWeight: 600 }}>{fact.value}</span>
              <span
                style={{
                  marginLeft: 6,
                  background: TIER_COLOR[fact.tier] ?? "#9ca3af",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "1px 7px",
                  fontSize: 10,
                }}
              >
                {fact.tier}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fieldLabel(field: string): string {
  return field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
