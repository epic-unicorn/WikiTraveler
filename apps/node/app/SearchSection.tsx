"use client";

import { useState, useCallback, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import {
  PropertySearchBar,
  PropertyCard,
  EMPTY_FILTERS,
  type SearchFilters,
  type PropertySummary,
} from "@wikitraveler/ui";

type MapPin = { id: string; name: string; location: string; lat: number; lon: number };

interface Props {
  onResults?: (pins: MapPin[] | null) => void;
}

function authHeaders(): HeadersInit {
  const m = document.cookie.match(/(?:^|;\s*)wt_token=([^;]+)/);
  const token = m ? decodeURIComponent(m[1]) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function buildParams(q: string, filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (filters.features.length) params.set("feature", filters.features.join(","));
  if (filters.audited === true) params.set("audited", "true");
  if (filters.audited === false) params.set("audited", "false");
  if (filters.location.trim()) params.set("location", filters.location.trim());
  return params;
}

export function SearchSection({ onResults }: Props) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [results, setResults] = useState<PropertySummary[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (q: string, f: SearchFilters) => {
      const hasQuery = q.trim().length > 0;
      const hasFilters =
        f.features.length > 0 ||
        f.audited !== null ||
        f.location.trim().length > 0;

      if (!hasQuery && !hasFilters) {
        setResults(null);
        onResults?.(null);
        return;
      }

      startTransition(async () => {
        const params = buildParams(q, f);
        const res = await fetch(`/api/properties?${params}`, { headers: authHeaders() });
        const data = (await res.json()) as { properties?: PropertySummary[] };
        const properties = data.properties ?? [];
        setResults(properties);
        onResults?.(
          properties
            .filter((p) => p.lat != null && p.lon != null)
            .map((p) => ({
              id: p.id,
              name: p.name,
              location: p.location,
              lat: p.lat!,
              lon: p.lon!,
            }))
        );
      });
    },
    [onResults]
  );

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => search(query, filters), 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, filters, search]);

  const hasActiveSearch =
    query.trim().length > 0 ||
    filters.features.length > 0 ||
    filters.audited !== null ||
    filters.location.trim().length > 0;

  return (
    <div>
      <PropertySearchBar
        query={query}
        onQueryChange={setQuery}
        filters={filters}
        onFiltersChange={setFilters}
        placeholder="Search by name, city, canonical ID, OSM or Wheelmap ID…"
      />

      {/* Loading */}
      {isPending && (
        <p style={{ color: "var(--wt-text-muted)", fontSize: 14, marginTop: 12 }}>
          Searching…
        </p>
      )}

      {/* Idle default state */}
      {!isPending && results === null && !hasActiveSearch && (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "var(--wt-text-muted)",
            border: "1.5px dashed var(--wt-border)",
            borderRadius: "var(--wt-radius-md)",
            marginTop: 12,
          }}
        >
          <p style={{ fontSize: 28, marginBottom: 10 }}>🗺️</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--wt-text)", marginBottom: 6 }}>
            Find properties
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>
            Search by name, location, or ID — or use the filter chips to browse by accessibility feature or audit status.
          </p>
        </div>
      )}

      {/* No results */}
      {!isPending && results !== null && results.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "36px 20px",
            border: "1px solid var(--wt-border)",
            borderRadius: "var(--wt-radius-md)",
            background: "var(--wt-bg-elevated)",
            marginTop: 12,
          }}
        >
          <p style={{ fontSize: 24, marginBottom: 10 }}>🔍</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--wt-text)", marginBottom: 6 }}>
            No properties found
          </p>
          {query.trim() ? (
            <>
              <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginBottom: 16 }}>
                No results matched &ldquo;{query.trim()}&rdquo;
              </p>
              <Link
                href={`/properties/new?name=${encodeURIComponent(query.trim())}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--wt-primary)",
                  color: "var(--wt-primary-contrast)",
                  padding: "9px 18px",
                  borderRadius: "var(--wt-radius-sm)",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                + Create &ldquo;{query.trim()}&rdquo;
              </Link>
            </>
          ) : (
            <p style={{ fontSize: 13, color: "var(--wt-text-muted)" }}>
              Try adjusting your filters.
            </p>
          )}
        </div>
      )}

      {/* Results */}
      {!isPending && results !== null && results.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: "var(--wt-text-muted)", marginTop: 12, marginBottom: 4 }}>
            {results.length} {results.length === 1 ? "property" : "properties"}
          </p>
          <div className="wt-search-results">
            {results.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                href={`/properties/${p.id}`}
              />
            ))}
          </div>
        </>
      )}

    </div>
  );
}
