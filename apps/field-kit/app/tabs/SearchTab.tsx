"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  PropertySearchBar,
  PropertyCard,
  EMPTY_FILTERS,
  type SearchFilters,
  type PropertySummary,
} from "@wikitraveler/ui";
import { searchProperties } from "../lib/fieldKitApi";
import { auditHref } from "../lib/auditHref";

interface Props {
  searchNodeUrl: string;
  homeNodeUrl: string;
  gpsResolved: { region: string | null } | null;
}

export function SearchTab({ searchNodeUrl, homeNodeUrl, gpsResolved }: Props) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [results, setResults] = useState<PropertySummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const hasActiveSearch =
    query.trim().length > 0 ||
    filters.features.length > 0 ||
    filters.audited !== null ||
    filters.location.trim().length > 0;

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    if (!hasActiveSearch) {
      setResults(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const properties = await searchProperties(
          searchNodeUrl,
          query,
          filters,
          controller.signal
        );
        setResults(properties);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setSearchError("Could not reach the node. Check Settings.");
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, filters, searchNodeUrl, hasActiveSearch]);

  return (
    <div className="tab-content">
      {/* Search bar */}
      <div style={{ paddingTop: 16, marginBottom: 4 }}>
        <PropertySearchBar
          query={query}
          onQueryChange={setQuery}
          filters={filters}
          onFiltersChange={setFilters}
          placeholder="Search properties…"
        />
      </div>

      {/* GPS region chip */}
      {gpsResolved && (
        <div style={{ marginBottom: 12 }}>
          <span className="fk-chip fk-chip--info">
            📍 {gpsResolved.region ?? searchNodeUrl}
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <p className="status-muted" style={{ textAlign: "center", padding: "20px 0" }}>
          Searching…
        </p>
      )}

      {/* Error */}
      {searchError && <p className="status-err">{searchError}</p>}

      {/* No results */}
      {results !== null && results.length === 0 && !loading && (
        <div className="fk-empty">
          <span className="fk-empty-icon">🔍</span>
          <p className="fk-empty-title">No results</p>
          <p className="fk-empty-body">
            {query.trim()
              ? `Nothing matched "${query.trim()}"`
              : "Try a different search or filter"}
            {" "}Tap <strong>+</strong> in the header to add a new property.
          </p>
        </div>
      )}

      {/* Results */}
      {results !== null && results.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {results.map((p) => (
            <Link key={p.id} href={auditHref(p.id, searchNodeUrl, homeNodeUrl)}>
              <PropertyCard property={p} actionLabel="Audit →" expandable={false} />
            </Link>
          ))}
        </div>
      )}

      {/* Default / idle state */}
      {results === null && !hasActiveSearch && !loading && (
        <div className="fk-empty">
          <span className="fk-empty-icon">🏨</span>
          <p className="fk-empty-title">Find a property</p>
          <p className="fk-empty-body">Search by name, city, or ID to start an audit.</p>
        </div>
      )}
    </div>
  );
}
