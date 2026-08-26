"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  PropertySearchBar,
  useLocale,
  type SearchFilters,
  type SearchFeature,
  type PropertySummary,
} from "@wikitraveler/ui";
import { searchProperties, fetchSearchFields } from "../lib/accessApi";
import { PropertyDiscoveryView, mapPinsToSummaries } from "../components/PropertyDiscoveryView";
import {
  filtersFromSearchParams,
  parseDiscoveryView,
  type AccessReturnState,
} from "../lib/navigationReturn";
import {
  getDiscoveryViewMode,
  setDiscoveryViewMode,
  type DiscoveryViewMode,
} from "../lib/discoveryUtils";
import { readSearchSession, writeSearchSession } from "../lib/searchSession";
import type { DataRegionResolve } from "../hooks/useNodeContext";
import type { MapPin } from "../lib/accessApi";

interface Props {
  /** Active data node (search / browse / property host). */
  dataNodeUrl: string;
  homeNodeUrl: string;
  dataRegion: DataRegionResolve | null;
  regionLabel?: string | null;
}

/** Match Admin dashboard search page size (API max 100). */
const SEARCH_PAGE_SIZE = 100;

function initialSearchState(searchParams: URLSearchParams): {
  query: string;
  filters: SearchFilters;
  view: DiscoveryViewMode;
  page: number;
} {
  const fromUrlQ = searchParams.get("q");
  const fromUrlView = parseDiscoveryView(searchParams.get("view"));
  const hasUrlState =
    fromUrlQ != null ||
    searchParams.has("features") ||
    searchParams.has("audited") ||
    searchParams.has("room") ||
    fromUrlView != null;

  // SSR + first client paint must match — never read sessionStorage here.
  if (hasUrlState) {
    return {
      query: fromUrlQ ?? "",
      filters: filtersFromSearchParams(searchParams),
      view: fromUrlView ?? "map",
      page: 1,
    };
  }

  return {
    query: "",
    filters: filtersFromSearchParams(searchParams),
    view: "map",
    page: 1,
  };
}

export function SearchTab({ dataNodeUrl, homeNodeUrl }: Props) {
  const { locale, t } = useLocale();
  const searchParams = useSearchParams();
  const [boot] = useState(() => initialSearchState(searchParams));
  const [query, setQuery] = useState(boot.query);
  const [filters, setFilters] = useState<SearchFilters>(boot.filters);
  const [discoveryView, setDiscoveryView] = useState<DiscoveryViewMode>(boot.view);
  const [searchFeatures, setSearchFeatures] = useState<SearchFeature[]>([]);
  const [results, setResults] = useState<PropertySummary[] | null>(null);
  const [page, setPage] = useState(boot.page);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [mapDataNodeUrl, setMapDataNodeUrl] = useState(dataNodeUrl);
  const [viewportPins, setViewportPins] = useState<MapPin[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const skipUrlHydrate = useRef(true);

  useEffect(() => {
    setDiscoveryViewMode(discoveryView);
  }, []);

  // Hydrate sessionStorage after mount (avoids SSR/client HTML mismatch).
  useEffect(() => {
    const fromUrlQ = searchParams.get("q");
    const fromUrlView = parseDiscoveryView(searchParams.get("view"));
    const hasUrlState =
      fromUrlQ != null ||
      searchParams.has("features") ||
      searchParams.has("audited") ||
      searchParams.has("room") ||
      fromUrlView != null;
    if (hasUrlState) return;

    const session = readSearchSession();
    if (session) {
      setQuery(session.query);
      setFilters(session.filters);
      setPage(session.page);
      setDiscoveryView(session.view);
      setDiscoveryViewMode(session.view);
      return;
    }

    const storedView = getDiscoveryViewMode();
    if (storedView !== "map") {
      setDiscoveryView(storedView);
      setDiscoveryViewMode(storedView);
    }
  }, []);

  // Restore search state when returning via back navigation (URL carries state).
  useEffect(() => {
    if (skipUrlHydrate.current) {
      skipUrlHydrate.current = false;
      return;
    }
    const nextQuery = searchParams.get("q") ?? "";
    const nextFilters = filtersFromSearchParams(searchParams);
    const nextView = parseDiscoveryView(searchParams.get("view"));
    setQuery(nextQuery);
    setFilters(nextFilters);
    setPage(1);
    if (nextView) {
      setDiscoveryView(nextView);
      setDiscoveryViewMode(nextView);
    }
  }, [searchParams]);

  useEffect(() => {
    writeSearchSession({ query, filters, page, view: discoveryView });
  }, [query, filters, page, discoveryView]);

  const returnState: AccessReturnState = useMemo(
    () => ({
      tab: "search",
      q: query,
      filters,
      view: discoveryView,
    }),
    [query, filters, discoveryView]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchSearchFields(dataNodeUrl, locale, controller.signal)
      .then((fields) => {
        setSearchFeatures(
          fields
            .filter((f) => f.searchFilter && f.valueType === "BOOLEAN")
            .map((f) => ({ key: f.fieldName, label: f.label }))
        );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [locale, dataNodeUrl]);

  useEffect(() => {
    setMapDataNodeUrl(dataNodeUrl);
  }, [dataNodeUrl]);

  const hasActiveSearch =
    query.trim().length > 0 ||
    filters.features.length > 0 ||
    filters.audited !== null ||
    filters.hasAccessibleRoom === true;

  // Reset to page 1 when the query/filters change.
  useEffect(() => {
    setPage(1);
  }, [query, filters, mapDataNodeUrl]);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    if (!hasActiveSearch) {
      setResults(null);
      setTotal(0);
      setLoading(false);
      setSearchError("");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const delay = 350;
    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const data = await searchProperties(mapDataNodeUrl, query, filters, controller.signal, {
          page,
          pageSize: SEARCH_PAGE_SIZE,
        });
        if (controller.signal.aborted) return;
        setResults(data.properties);
        setTotal(data.total);
      } catch (e) {
        if (controller.signal.aborted || (e as Error).name === "AbortError") return;
        setSearchError(t("ui.regionUnreachable"));
        setResults(null);
        setTotal(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, filters, mapDataNodeUrl, hasActiveSearch, page, t]);

  const browseListProperties = useMemo(
    () => mapPinsToSummaries(viewportPins),
    [viewportPins]
  );
  const displayProperties: PropertySummary[] = hasActiveSearch
    ? (results ?? [])
    : browseListProperties;
  const totalPages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
  const rangeFrom = total === 0 ? 0 : (page - 1) * SEARCH_PAGE_SIZE + 1;
  const rangeTo = Math.min(page * SEARCH_PAGE_SIZE, total);

  const emptyState = hasActiveSearch ? (
    results !== null && results.length === 0 && !loading ? (
      <div className="fk-empty">
        <span className="fk-empty-icon">🔍</span>
        <p className="fk-empty-title">{t("ui.searchNoResults")}</p>
        <p className="fk-empty-body">
          {query.trim()
            ? t("ui.searchNoMatch", { query: query.trim() })
            : t("ui.searchTryDifferent")}
        </p>
      </div>
    ) : null
  ) : (
    <div className="fk-empty">
      <span className="fk-empty-icon">🔍</span>
      <p className="fk-empty-title">{t("ui.searchListEmptyTitle")}</p>
      <p className="fk-empty-body">{t("ui.searchListEmptyBody")}</p>
    </div>
  );

  return (
    <div className="tab-content fk-search-tab">
      <div className="fk-search-header">
        <PropertySearchBar
          query={query}
          onQueryChange={setQuery}
          filters={filters}
          onFiltersChange={setFilters}
          searchFeatures={searchFeatures}
          alwaysShowFilters
        />
        {hasActiveSearch && results !== null && !loading && total > SEARCH_PAGE_SIZE && (
          <p className="status-muted fk-search-pagination-notice" role="status">
            {t("ui.searchPaginationNotice", {
              total,
              pageSize: SEARCH_PAGE_SIZE,
              page,
              totalPages,
            })}
          </p>
        )}
        {hasActiveSearch && results !== null && !loading && (
          <p className="status-muted fk-search-result-count">
            {total === 1
              ? t("ui.searchSingleProperty")
              : t("ui.searchShowingRange", { from: rangeFrom, to: rangeTo, total })}
          </p>
        )}
        {hasActiveSearch && results !== null && !loading && totalPages > 1 && (
          <div className="fk-search-pagination">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t("ui.adminPrevPage")}
            </button>
            <span className="status-muted">
              {t("ui.adminPageOf", { page, total: totalPages })}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t("ui.adminNextPage")}
            </button>
          </div>
        )}
      </div>

      <PropertyDiscoveryView
        properties={displayProperties}
        loading={hasActiveSearch ? loading : false}
        error={hasActiveSearch ? searchError : ""}
        homeNodeUrl={homeNodeUrl}
        propertyNodeUrl={mapDataNodeUrl}
        active
        emptyState={emptyState}
        mapAutoFit={hasActiveSearch}
        returnState={returnState}
        onViewModeChange={setDiscoveryView}
        initialViewMode={discoveryView}
        viewportBrowse={!hasActiveSearch}
        onDataNodeUrlChange={setMapDataNodeUrl}
        onViewportPinsChange={setViewportPins}
      />
    </div>
  );
}
