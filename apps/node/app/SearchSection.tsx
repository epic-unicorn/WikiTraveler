"use client";

import { useState, useCallback, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import {
  PropertySearchBar,
  PropertyCard,
  EMPTY_FILTERS,
  useLocale,
  type SearchFilters,
  type PropertySummary,
  type SearchFeature,
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
  if (filters.hasAccessibleRoom) params.set("hasAccessibleRoom", "true");
  return params;
}

export function SearchSection({ onResults }: Props) {
  const { locale, t } = useLocale();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [searchFeatures, setSearchFeatures] = useState<SearchFeature[]>([]);
  const [results, setResults] = useState<PropertySummary[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/fields?locale=${locale}`)
      .then((r) => r.json())
      .then((data: { fields?: Array<{ fieldName: string; label: string; searchFilter: boolean; valueType: string }> }) => {
        const chips = (data.fields ?? [])
          .filter((f) => f.searchFilter && f.valueType === "BOOLEAN")
          .map((f) => ({ key: f.fieldName, label: f.label }));
        setSearchFeatures(chips);
      })
      .catch(() => {});
  }, [locale]);

  const search = useCallback(
    (q: string, f: SearchFilters) => {
      const hasQuery = q.trim().length > 0;
      const hasFilters =
        f.features.length > 0 ||
        f.audited !== null ||
        f.hasAccessibleRoom ||
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
    filters.hasAccessibleRoom ||
    filters.location.trim().length > 0;

  return (
    <div>
      <PropertySearchBar
        query={query}
        onQueryChange={setQuery}
        filters={filters}
        onFiltersChange={setFilters}
        placeholder={t("ui.searchPlaceholder")}
        searchFeatures={searchFeatures}
        labels={{
          audited: t("ui.filterAudited"),
          notAudited: t("ui.filterNotAudited"),
          locationPlaceholder: t("ui.filterLocation"),
          hasAccessibleRoom: t("ui.filterHasAccessibleRoom"),
        }}
      />

      {/* Loading */}
      {isPending && (
        <p style={{ color: "var(--wt-text-muted)", fontSize: 14, marginTop: 12 }}>
          {t("ui.searching")}
        </p>
      )}

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
            {t("ui.searchFindProperties")}
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>
            {t("ui.searchFindPropertiesBody")}
          </p>
        </div>
      )}

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
            {t("ui.searchNoPropertiesFound")}
          </p>
          {query.trim() ? (
            <>
              <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginBottom: 16 }}>
                {t("ui.searchNoMatch", { query: query.trim() })}
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
                + {t("ui.searchCreateProperty", { name: query.trim() })}
              </Link>
            </>
          ) : (
            <p style={{ fontSize: 13, color: "var(--wt-text-muted)" }}>
              {t("ui.searchAdjustFilters")}
            </p>
          )}
        </div>
      )}

      {!isPending && results !== null && results.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: "var(--wt-text-muted)", marginTop: 12, marginBottom: 4 }}>
            {results.length === 1
              ? t("ui.searchSingleProperty")
              : t("ui.searchPropertyCount", { count: results.length })}
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
