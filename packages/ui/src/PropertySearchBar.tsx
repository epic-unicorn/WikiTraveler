"use client";

import { SEARCH_FEATURES } from "./constants";
import { useLocale } from "./LocaleProvider";

export interface SearchFilters {
  features: string[];
  audited: boolean | null;
  location: string;
  hasAccessibleRoom?: boolean | null;
}

export const EMPTY_FILTERS: SearchFilters = {
  features: [],
  audited: null,
  location: "",
  hasAccessibleRoom: null,
};

export interface SearchFeature {
  key: string;
  label: string;
}

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  filters: SearchFilters;
  onFiltersChange: (f: SearchFilters) => void;
  placeholder?: string;
  showFilters?: boolean;
  searchFeatures?: SearchFeature[];
  labels?: {
    audited?: string;
    notAudited?: string;
    locationPlaceholder?: string;
    hasAccessibleRoom?: string;
  };
}

export function PropertySearchBar({
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  placeholder,
  showFilters = true,
  searchFeatures,
  labels = {},
}: Props) {
  const { t } = useLocale();

  const resolvedPlaceholder = placeholder ?? t("ui.searchPlaceholder");
  const features = searchFeatures ?? (SEARCH_FEATURES as unknown as SearchFeature[]);
  const resolvedLabels = {
    audited: labels.audited ?? t("ui.filterAudited"),
    notAudited: labels.notAudited ?? t("ui.filterNotAudited"),
    locationPlaceholder: labels.locationPlaceholder ?? t("ui.filterLocation"),
    hasAccessibleRoom: labels.hasAccessibleRoom ?? t("ui.filterHasAccessibleRoom"),
  };

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

  function toggleAccessibleRoom() {
    onFiltersChange({
      ...filters,
      hasAccessibleRoom: filters.hasAccessibleRoom ? null : true,
    });
  }

  const chipBase: React.CSSProperties = {
    borderRadius: 20,
    padding: "8px 14px",
    minHeight: 44,
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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    fontSize: 16,
    border: "1.5px solid var(--wt-border)",
    borderRadius: "var(--wt-radius-sm)",
    boxSizing: "border-box",
    background: "var(--wt-bg-elevated)",
    color: "var(--wt-text)",
    marginBottom: showFilters ? 12 : 0,
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor="wt-property-search" className="wt-sr-only">
        {resolvedPlaceholder}
      </label>
      <input
        id="wt-property-search"
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={resolvedPlaceholder}
        style={inputStyle}
      />

      {showFilters && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }} role="group" aria-label={resolvedLabels.audited}>
            <button
              type="button"
              style={filters.audited === true ? chipActive : chipBase}
              aria-pressed={filters.audited === true}
              onClick={() => toggleAudited(true)}
            >
              {resolvedLabels.audited}
            </button>
            <button
              type="button"
              style={filters.audited === false ? chipActive : chipBase}
              aria-pressed={filters.audited === false}
              onClick={() => toggleAudited(false)}
            >
              {resolvedLabels.notAudited}
            </button>
            {resolvedLabels.hasAccessibleRoom && (
              <button
                type="button"
                style={filters.hasAccessibleRoom ? chipActive : chipBase}
                aria-pressed={!!filters.hasAccessibleRoom}
                onClick={toggleAccessibleRoom}
              >
                {resolvedLabels.hasAccessibleRoom}
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }} role="group" aria-label={resolvedPlaceholder}>
            {features.map((f) => (
              <button
                key={f.key}
                type="button"
                style={filters.features.includes(f.key) ? chipActive : chipBase}
                aria-pressed={filters.features.includes(f.key)}
                onClick={() => toggleFeature(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <label htmlFor="wt-location-filter" className="wt-sr-only">
            {resolvedLabels.locationPlaceholder}
          </label>
          <input
            id="wt-location-filter"
            type="text"
            value={filters.location}
            onChange={(e) => onFiltersChange({ ...filters, location: e.target.value })}
            placeholder={resolvedLabels.locationPlaceholder}
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
