"use client";

import { useState, useCallback, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { createRequestCounter } from "@wikitraveler/core";
import {
  PropertySearchBar,
  PropertyCard,
  EMPTY_FILTERS,
  useLocale,
  type SearchFilters,
  type PropertySummary,
  type SearchFeature,
} from "@wikitraveler/ui";

type MapPin = {
  id: string;
  name: string;
  location: string;
  lat: number;
  lon: number;
  audited?: boolean;
};

interface Props {
  onResults?: (pins: MapPin[] | null) => void;
  onSelectPin?: (pin: MapPin) => void;
}

const AUDITED_TIERS = new Set(["VERIFIED", "CONFIRMED"]);
/** Admin dashboard search page size (API max is 100). Access keeps default 30. */
const SEARCH_PAGE_SIZE = 100;

function authHeaders(): HeadersInit {
  const m = document.cookie.match(/(?:^|;\s*)wt_token=([^;]+)/);
  const token = m ? decodeURIComponent(m[1]) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function buildParams(q: string, filters: SearchFilters, page: number): URLSearchParams {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (filters.features.length) params.set("feature", filters.features.join(","));
  if (filters.audited === true) params.set("audited", "true");
  if (filters.audited === false) params.set("audited", "false");
  if (filters.location.trim()) params.set("location", filters.location.trim());
  if (filters.hasAccessibleRoom) params.set("hasAccessibleRoom", "true");
  params.set("page", String(page));
  params.set("pageSize", String(SEARCH_PAGE_SIZE));
  return params;
}

function hasActiveSearch(q: string, f: SearchFilters): boolean {
  return (
    q.trim().length > 0 ||
    f.features.length > 0 ||
    f.audited !== null ||
    f.hasAccessibleRoom ||
    f.location.trim().length > 0
  );
}

export function SearchSection({ onResults, onSelectPin }: Props) {
  const { locale, t } = useLocale();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchFeatures, setSearchFeatures] = useState<SearchFeature[]>([]);
  const [results, setResults] = useState<PropertySummary[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequest = useRef(createRequestCounter());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/fields?locale=${locale}`)
      .then((r) => r.json())
      .then((data: { fields?: Array<{ fieldName: string; label: string; searchFilter: boolean; valueType: string }> }) => {
        if (cancelled) return;
        const chips = (data.fields ?? [])
          .filter((f) => f.searchFilter && f.valueType === "BOOLEAN")
          .map((f) => ({ key: f.fieldName, label: f.label }));
        setSearchFeatures(chips);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const runSearch = useCallback(
    (q: string, f: SearchFilters, pageNum: number) => {
      if (!hasActiveSearch(q, f)) {
        setResults(null);
        setTotal(0);
        onResults?.(null);
        return;
      }

      startTransition(async () => {
        const requestId = searchRequest.current.next();
        const params = buildParams(q, f, pageNum);
        const res = await fetch(`/api/properties?${params}`, { headers: authHeaders() });
        if (!searchRequest.current.isLatest(requestId)) return;
        const data = (await res.json()) as {
          properties?: PropertySummary[];
          total?: number;
          page?: number;
          pageSize?: number;
        };
        const properties = data.properties ?? [];
        if (!searchRequest.current.isLatest(requestId)) return;
        setResults(properties);
        setTotal(typeof data.total === "number" ? data.total : properties.length);
        onResults?.(
          properties
            .filter((p) => p.lat != null && p.lon != null)
            .map((p) => ({
              id: p.id,
              name: p.name,
              location: p.location,
              lat: p.lat!,
              lon: p.lon!,
              audited: (p.facts ?? []).some((f) => AUDITED_TIERS.has(f.tier)),
            }))
        );
      });
    },
    [onResults]
  );

  // Debounced search when query/filters change — always page 1.
  useEffect(() => {
    setPage(1);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => runSearch(query, filters, 1), 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, filters, runSearch]);

  const totalPages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
  const rangeFrom = total === 0 ? 0 : (page - 1) * SEARCH_PAGE_SIZE + 1;
  const rangeTo = Math.min(page * SEARCH_PAGE_SIZE, total);
  const active = hasActiveSearch(query, filters);

  function goToPage(next: number) {
    const clamped = Math.min(totalPages, Math.max(1, next));
    setPage(clamped);
    runSearch(query, filters, clamped);
  }

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
          hasAccessibleRoom: t("ui.filterHasAccessibleRoom"),
        }}
      />

      {isPending && (
        <p style={{ color: "var(--wt-text-muted)", fontSize: 14, marginTop: 12 }}>
          {t("ui.searching")}
        </p>
      )}

      {!isPending && results === null && !active && (
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
                href={`/stats?tab=properties&name=${encodeURIComponent(query.trim())}`}
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
          {total > SEARCH_PAGE_SIZE && (
            <div
              role="status"
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--wt-border)",
                background: "var(--wt-bg-elevated)",
                fontSize: 13,
                lineHeight: 1.45,
                color: "var(--wt-text)",
              }}
            >
              {t("ui.searchPaginationNotice", {
                total,
                pageSize: SEARCH_PAGE_SIZE,
                page,
                totalPages,
              })}
            </div>
          )}
          <p style={{ fontSize: 12, color: "var(--wt-text-muted)", marginTop: 12, marginBottom: 4 }}>
            {total === 1
              ? t("ui.searchSingleProperty")
              : t("ui.searchShowingRange", { from: rangeFrom, to: rangeTo, total })}
          </p>
          <div className="wt-search-results">
            {results.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                href={`/properties/${p.id}`}
                onSelect={
                  onSelectPin && p.lat != null && p.lon != null
                    ? () =>
                        onSelectPin({
                          id: p.id,
                          name: p.name,
                          location: p.location,
                          lat: p.lat!,
                          lon: p.lon!,
                          audited: (p.facts ?? []).some((f) => AUDITED_TIERS.has(f.tier)),
                        })
                    : undefined
                }
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginTop: 12,
              }}
            >
              <button
                type="button"
                disabled={page <= 1 || isPending}
                onClick={() => goToPage(page - 1)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--wt-border)",
                  background: "var(--wt-bg-elevated)",
                  color: "var(--wt-text)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                  opacity: page <= 1 ? 0.5 : 1,
                  fontFamily: "inherit",
                }}
              >
                {t("ui.adminPrevPage")}
              </button>
              <span style={{ fontSize: 12, color: "var(--wt-text-muted)" }}>
                {t("ui.adminPageOf", { page, total: totalPages })}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || isPending}
                onClick={() => goToPage(page + 1)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--wt-border)",
                  background: "var(--wt-bg-elevated)",
                  color: "var(--wt-text)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                  opacity: page >= totalPages ? 0.5 : 1,
                  fontFamily: "inherit",
                }}
              >
                {t("ui.adminNextPage")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
