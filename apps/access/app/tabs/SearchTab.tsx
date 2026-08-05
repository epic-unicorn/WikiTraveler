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
import { searchProperties, fetchMapPins, fetchSearchFields, type MapPin } from "../lib/accessApi";
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
import type { DataRegionResolve } from "../hooks/useNodeContext";

interface Props {
  /** Active data node (search / browse / property host). */
  dataNodeUrl: string;
  homeNodeUrl: string;
  dataRegion: DataRegionResolve | null;
  regionLabel?: string | null;
}

export function SearchTab({ dataNodeUrl, homeNodeUrl, dataRegion }: Props) {
  const { locale, t } = useLocale();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [filters, setFilters] = useState<SearchFilters>(() =>
    filtersFromSearchParams(searchParams)
  );
  const [discoveryView, setDiscoveryView] = useState<DiscoveryViewMode>(() => {
    const fromUrl = parseDiscoveryView(searchParams.get("view"));
    return fromUrl ?? getDiscoveryViewMode();
  });
  const [searchFeatures, setSearchFeatures] = useState<SearchFeature[]>([]);
  const [results, setResults] = useState<PropertySummary[] | null>(null);
  const [browsePins, setBrowsePins] = useState<MapPin[]>([]);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const uncovered = dataRegion?.matched === "fallback";
  const regionReady = dataRegion !== null;

  // Restore search state when returning via back navigation (URL carries state).
  useEffect(() => {
    const nextQuery = searchParams.get("q") ?? "";
    const nextFilters = filtersFromSearchParams(searchParams);
    const nextView = parseDiscoveryView(searchParams.get("view"));
    setQuery(nextQuery);
    setFilters(nextFilters);
    if (nextView) {
      setDiscoveryView(nextView);
      setDiscoveryViewMode(nextView);
    }
  }, [searchParams]);

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

  const hasActiveSearch =
    query.trim().length > 0 ||
    filters.features.length > 0 ||
    filters.audited !== null ||
    filters.hasAccessibleRoom;

  // Browse map: data-node pins only (never home dump as "the world"). Skip when uncovered.
  useEffect(() => {
    if (hasActiveSearch) return;
    if (!regionReady || uncovered) {
      setBrowsePins([]);
      setBrowseLoading(!regionReady);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setBrowseLoading(true);
    fetchMapPins(dataNodeUrl, controller.signal)
      .then((pins) => {
        if (!cancelled) setBrowsePins(pins);
      })
      .catch(() => {
        if (!cancelled) setBrowsePins([]);
      })
      .finally(() => {
        if (!cancelled) setBrowseLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [hasActiveSearch, dataNodeUrl, regionReady, uncovered]);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    if (!hasActiveSearch) {
      setResults(null);
      setLoading(false);
      setSearchError("");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        if (uncovered) {
          if (!controller.signal.aborted) {
            setSearchError(t("ui.regionNotCovered"));
            setResults([]);
          }
          return;
        }
        const properties = await searchProperties(
          dataNodeUrl,
          query,
          filters,
          controller.signal
        );
        if (controller.signal.aborted) return;
        setResults(properties);
      } catch (e) {
        // A superseded (aborted) request must never clobber the newer one.
        if (controller.signal.aborted || (e as Error).name === "AbortError") return;
        setSearchError(t("ui.regionUnreachable"));
        setResults(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, filters, dataNodeUrl, hasActiveSearch, uncovered, t]);

  const browseProperties = useMemo(() => mapPinsToSummaries(browsePins), [browsePins]);
  const displayProperties: PropertySummary[] = hasActiveSearch ? (results ?? []) : browseProperties;

  const displayLoading = hasActiveSearch ? loading : browseLoading;
  const displayError = hasActiveSearch ? searchError : "";

  const emptyState = hasActiveSearch ? (
    results !== null && results.length === 0 && !loading ? (
      <div className="fk-empty">
        <span className="fk-empty-icon">🔍</span>
        <p className="fk-empty-title">
          {uncovered ? t("ui.regionNotCovered") : t("ui.searchNoResults")}
        </p>
        <p className="fk-empty-body">
          {uncovered
            ? t("ui.regionNotCoveredHint")
            : query.trim()
              ? t("ui.searchNoMatch", { query: query.trim() })
              : t("ui.searchTryDifferent")}{" "}
          {!uncovered ? t("ui.searchTapPlus") : null}
        </p>
      </div>
    ) : null
  ) : uncovered ? (
    <div className="fk-empty">
      <span className="fk-empty-icon">🗺️</span>
      <p className="fk-empty-title">{t("ui.regionNotCovered")}</p>
      <p className="fk-empty-body">{t("ui.regionNotCoveredHint")}</p>
    </div>
  ) : browsePins.length === 0 && !browseLoading && regionReady ? (
    <div className="fk-empty">
      <span className="fk-empty-icon">🗺️</span>
      <p className="fk-empty-title">{t("ui.regionEmptyMap")}</p>
      <p className="fk-empty-body">{t("ui.discoveryBrowseHint")}</p>
    </div>
  ) : null;

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
        {hasActiveSearch && results !== null && !loading && (
          <p className="status-muted fk-search-result-count">
            {results.length === 1
              ? t("ui.searchSingleProperty")
              : t("ui.searchPropertyCount", { count: results.length })}
          </p>
        )}
      </div>

      <PropertyDiscoveryView
        properties={displayProperties}
        loading={displayLoading}
        error={displayError}
        homeNodeUrl={homeNodeUrl}
        propertyNodeUrl={dataNodeUrl}
        active
        emptyState={emptyState}
        mapAutoFit
        returnState={returnState}
        onViewModeChange={setDiscoveryView}
        initialViewMode={parseDiscoveryView(searchParams.get("view"))}
      />
    </div>
  );
}
