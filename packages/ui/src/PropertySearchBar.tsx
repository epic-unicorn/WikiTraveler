"use client";

import { useEffect, useRef, useState } from "react";
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

export interface SearchSuggestion {
  id: string;
  label: string;
  sublabel?: string;
}

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  filters: SearchFilters;
  onFiltersChange: (f: SearchFilters) => void;
  placeholder?: string;
  showFilters?: boolean;
  /** Search input + filter chips in one unified bar (Access). */
  alwaysShowFilters?: boolean;
  searchFeatures?: SearchFeature[];
  suggestions?: SearchSuggestion[];
  onSuggestionSelect?: (id: string) => void;
  labels?: {
    audited?: string;
    notAudited?: string;
    hasAccessibleRoom?: string;
    advancedFilters?: string;
  };
}

function countAdvancedFilters(filters: SearchFilters): number {
  let n = 0;
  if (filters.audited !== null) n++;
  if (filters.hasAccessibleRoom) n++;
  n += filters.features.length;
  return n;
}

export function PropertySearchBar({
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  placeholder,
  showFilters = true,
  alwaysShowFilters = false,
  searchFeatures,
  suggestions,
  onSuggestionSelect,
  labels = {},
}: Props) {
  const { t } = useLocale();

  const resolvedPlaceholder = placeholder ?? t("ui.searchPlaceholder");
  const features = searchFeatures ?? (SEARCH_FEATURES as unknown as SearchFeature[]);
  const resolvedLabels = {
    audited: labels.audited ?? t("ui.filterAudited"),
    notAudited: labels.notAudited ?? t("ui.filterNotAudited"),
    hasAccessibleRoom: labels.hasAccessibleRoom ?? t("ui.filterHasAccessibleRoom"),
    advancedFilters: labels.advancedFilters ?? t("ui.filterAdvanced"),
  };

  const activeAdvancedCount = countAdvancedFilters(filters);
  const [advancedOpen, setAdvancedOpen] = useState(activeAdvancedCount > 0);
  const [focused, setFocused] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const filterWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeAdvancedCount > 0) setAdvancedOpen(true);
  }, [activeAdvancedCount]);

  useEffect(() => {
    if (!popoverOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (filterWrapRef.current && !filterWrapRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPopoverOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [popoverOpen]);

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

  const showSuggestions =
    focused && !!suggestions && suggestions.length > 0 && query.trim().length > 0;

  const clearSearchButton = query.length > 0 && (
    <button
      type="button"
      className="wt-search-clear-btn"
      aria-label={t("ui.clearSearch")}
      title={t("ui.clearSearch")}
      onClick={() => onQueryChange("")}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );

  const filterChips = (
    <>
      <button
        type="button"
        className={`wt-search-chip${filters.audited === true ? " wt-search-chip--active" : ""}`}
        aria-pressed={filters.audited === true}
        onClick={() => toggleAudited(true)}
      >
        {resolvedLabels.audited}
      </button>
      <button
        type="button"
        className={`wt-search-chip${filters.audited === false ? " wt-search-chip--active" : ""}`}
        aria-pressed={filters.audited === false}
        onClick={() => toggleAudited(false)}
      >
        {resolvedLabels.notAudited}
      </button>
      {resolvedLabels.hasAccessibleRoom && (
        <button
          type="button"
          className={`wt-search-chip${filters.hasAccessibleRoom ? " wt-search-chip--active" : ""}`}
          aria-pressed={!!filters.hasAccessibleRoom}
          onClick={toggleAccessibleRoom}
        >
          {resolvedLabels.hasAccessibleRoom}
        </button>
      )}
      {features.map((f) => (
        <button
          key={f.key}
          type="button"
          className={`wt-search-chip${filters.features.includes(f.key) ? " wt-search-chip--active" : ""}`}
          aria-pressed={filters.features.includes(f.key)}
          onClick={() => toggleFeature(f.key)}
        >
          {f.label}
        </button>
      ))}
    </>
  );

  if (alwaysShowFilters && showFilters) {
    return (
      <div className="wt-search-bar" style={{ marginBottom: 16 }}>
        <div className="wt-search-unified">
          <span className="wt-search-unified-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <label htmlFor="wt-property-search" className="wt-sr-only">
            {resolvedPlaceholder}
          </label>
          <input
            id="wt-property-search"
            type="search"
            autoComplete="off"
            className="wt-search-unified-input"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={resolvedPlaceholder}
            aria-expanded={showSuggestions}
            aria-controls="wt-search-suggestions"
            role="combobox"
          />
          {clearSearchButton}
          <div className="wt-search-filter-wrap" ref={filterWrapRef}>
            <button
              type="button"
              className={`wt-search-filter-btn${popoverOpen ? " wt-search-filter-btn--open" : ""}${activeAdvancedCount > 0 ? " wt-search-filter-btn--has-active" : ""}`}
              aria-haspopup="dialog"
              aria-expanded={popoverOpen}
              aria-label={resolvedLabels.advancedFilters}
              title={resolvedLabels.advancedFilters}
              onClick={() => setPopoverOpen((v) => !v)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="7" y1="12" x2="17" y2="12" />
                <line x1="10" y1="18" x2="14" y2="18" />
              </svg>
              {activeAdvancedCount > 0 && (
                <span className="wt-search-filter-count" aria-hidden="true">{activeAdvancedCount}</span>
              )}
            </button>
            {popoverOpen && (
              <div className="wt-search-filter-popover" role="dialog" aria-label={resolvedLabels.advancedFilters}>
                <div className="wt-search-filter-popover-head">
                  <span>{resolvedLabels.advancedFilters}</span>
                  {activeAdvancedCount > 0 && (
                    <button
                      type="button"
                      className="wt-search-filter-clear"
                      onClick={() =>
                        onFiltersChange({ ...filters, features: [], audited: null, hasAccessibleRoom: null })
                      }
                    >
                      {t("ui.reset")}
                    </button>
                  )}
                </div>
                <div className="wt-search-filter-popover-chips">{filterChips}</div>
              </div>
            )}
          </div>
        </div>
        {showSuggestions && (
          <ul id="wt-search-suggestions" className="wt-search-suggestions" role="listbox">
            {suggestions!.map((s) => (
              <li key={s.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="wt-search-suggestion"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSuggestionSelect?.(s.id);
                    setFocused(false);
                  }}
                >
                  <span className="wt-search-suggestion-label">{s.label}</span>
                  {s.sublabel && <span className="wt-search-suggestion-sub">{s.sublabel}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
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
    padding: query.length > 0 ? "12px 40px 12px 16px" : "12px 16px",
    fontSize: 16,
    border: "1.5px solid var(--wt-border)",
    borderRadius: "var(--wt-radius-sm)",
    boxSizing: "border-box",
    background: "var(--wt-bg-elevated)",
    color: "var(--wt-text)",
    marginBottom: showFilters ? 8 : 0,
  };

  const summaryStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    fontWeight: 600,
    color: "var(--wt-text)",
    cursor: "pointer",
    listStyle: "none",
    marginBottom: advancedOpen ? 10 : 0,
  };

  const filterControls = (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }} role="group" aria-label={resolvedLabels.audited}>
        <button type="button" style={filters.audited === true ? chipActive : chipBase} aria-pressed={filters.audited === true} onClick={() => toggleAudited(true)}>
          {resolvedLabels.audited}
        </button>
        <button type="button" style={filters.audited === false ? chipActive : chipBase} aria-pressed={filters.audited === false} onClick={() => toggleAudited(false)}>
          {resolvedLabels.notAudited}
        </button>
        {resolvedLabels.hasAccessibleRoom && (
          <button type="button" style={filters.hasAccessibleRoom ? chipActive : chipBase} aria-pressed={!!filters.hasAccessibleRoom} onClick={toggleAccessibleRoom}>
            {resolvedLabels.hasAccessibleRoom}
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }} role="group" aria-label={resolvedPlaceholder}>
        {features.map((f) => (
          <button key={f.key} type="button" style={filters.features.includes(f.key) ? chipActive : chipBase} aria-pressed={filters.features.includes(f.key)} onClick={() => toggleFeature(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="wt-search-input-wrap">
        <label htmlFor="wt-property-search" className="wt-sr-only">
          {resolvedPlaceholder}
        </label>
        <input
          id="wt-property-search"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={resolvedPlaceholder}
          style={inputStyle}
          aria-expanded={showSuggestions}
          aria-controls="wt-search-suggestions"
          role="combobox"
        />
        {clearSearchButton}
        {showSuggestions && (
          <ul id="wt-search-suggestions" className="wt-search-suggestions" role="listbox">
            {suggestions!.map((s) => (
              <li key={s.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="wt-search-suggestion"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSuggestionSelect?.(s.id);
                    setFocused(false);
                  }}
                >
                  <span className="wt-search-suggestion-label">{s.label}</span>
                  {s.sublabel && <span className="wt-search-suggestion-sub">{s.sublabel}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showFilters && (
        <details
          className="wt-search-advanced"
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
          style={{ marginTop: 4 }}
        >
          <summary style={summaryStyle}>
            <span>{resolvedLabels.advancedFilters}</span>
            {activeAdvancedCount > 0 && (
              <span className="wt-search-filter-count">{activeAdvancedCount}</span>
            )}
          </summary>
          {filterControls}
        </details>
      )}
    </div>
  );
}
