"use client";

import { SEARCH_FEATURES } from "./constants";

export interface SearchFilters {
  features: string[];
  audited: boolean | null;
  location: string;
}

export const EMPTY_FILTERS: SearchFilters = {
  features: [],
  audited: null,
  location: "",
};

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  filters: SearchFilters;
  onFiltersChange: (f: SearchFilters) => void;
  placeholder?: string;
  showFilters?: boolean;
}

export function PropertySearchBar({
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  placeholder = "Search by name, city, ID…",
  showFilters = true,
}: Props) {
  function toggleFeature(key: string) {
    const next = filters.features.includes(key)
      ? filters.features.filter((f) => f !== key)
      : [...filters.features, key];
    onFiltersChange({ ...filters, features: next });
  }

  function toggleAudited(value: boolean | null) {
    onFiltersChange({
      ...filters,
      audited: filters.audited === value ? null : value,
    });
  }

  const chipBase: React.CSSProperties = {
    borderRadius: 20,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid var(--wt-border)",
    background: "var(--wt-bg-elevated)",
    color: "var(--wt-text)",
  };

  const chipActive: React.CSSProperties = {
    ...chipBase,
    background: "var(--wt-primary)",
    color: "var(--wt-primary-contrast)",
    borderColor: "var(--wt-primary)",
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "12px 16px",
          fontSize: 16,
          border: "1.5px solid var(--wt-border)",
          borderRadius: "var(--wt-radius-sm)",
          outline: "none",
          boxSizing: "border-box",
          background: "var(--wt-bg-elevated)",
          color: "var(--wt-text)",
          marginBottom: showFilters ? 12 : 0,
        }}
      />

      {showFilters && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <button
              type="button"
              style={filters.audited === true ? chipActive : chipBase}
              onClick={() => toggleAudited(true)}
            >
              Audited
            </button>
            <button
              type="button"
              style={filters.audited === false ? chipActive : chipBase}
              onClick={() => toggleAudited(false)}
            >
              Not audited
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {SEARCH_FEATURES.map((f) => (
              <button
                key={f.key}
                type="button"
                style={filters.features.includes(f.key) ? chipActive : chipBase}
                onClick={() => toggleFeature(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={filters.location}
            onChange={(e) => onFiltersChange({ ...filters, location: e.target.value })}
            placeholder="Filter by location (city, region…)"
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 14,
              border: "1px solid var(--wt-border)",
              borderRadius: "var(--wt-radius-sm)",
              background: "var(--wt-bg-elevated)",
              color: "var(--wt-text)",
              boxSizing: "border-box",
            }}
          />
        </>
      )}
    </div>
  );
}
