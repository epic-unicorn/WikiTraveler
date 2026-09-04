"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  PropertySearchBar,
  useLocale,
  type SearchFilters,
  type SearchFeature,
  type PropertySummary,
} from "@wikitraveler/ui";
import {
  searchProperties,
  fetchSearchFields,
  fetchNearbyProperties,
  resolvePeerNode,
  toClientNodeUrl,
} from "../lib/accessApi";
import { PropertyDiscoveryView, mapPinsToSummaries } from "../components/PropertyDiscoveryView";
import { AccessPageHero } from "../components/AccessPageHero";
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
import { geocodePlace, looksLikePlaceQuery } from "../lib/geocodePlace";
import { requestUserLocation } from "../lib/geolocation";
import { dataNodeFromResolve, isConfirmedUncovered } from "../lib/peerCoverage";
import {
  extrasFromFeatures,
  featuresFromPrefs,
  hasExplicitSearch,
  overridesFromFeatures,
  readA11yPreferences,
  subscribeA11yPreferences,
  type A11yPreferenceKey,
} from "../lib/a11yPreferences";

interface Props {
  dataNodeUrl: string;
  homeNodeUrl: string;
  dataRegion: DataRegionResolve | null;
  regionLabel?: string | null;
  active?: boolean;
}

const SEARCH_PAGE_SIZE = 100;
const NEAR_ME_RADIUS_KM = 1;

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

export function SearchTab({ dataNodeUrl, homeNodeUrl, active = true }: Props) {
  const { locale, t } = useLocale();
  const searchParams = useSearchParams();
  const [boot] = useState(() => initialSearchState(searchParams));
  const [query, setQuery] = useState(boot.query);
  const [filters, setFilters] = useState<SearchFilters>(boot.filters);
  const [profilePrefs, setProfilePrefs] = useState<A11yPreferenceKey[]>([]);
  const [prefOverridesOff, setPrefOverridesOff] = useState<string[]>([]);
  const [discoveryView, setDiscoveryView] = useState<DiscoveryViewMode>(boot.view);
  const [searchFeatures, setSearchFeatures] = useState<SearchFeature[]>([]);
  const [results, setResults] = useState<PropertySummary[] | null>(null);
  const [page, setPage] = useState(boot.page);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [geoError, setGeoError] = useState("");
  const [mapDataNodeUrl, setMapDataNodeUrl] = useState(dataNodeUrl);
  const [viewportPins, setViewportPins] = useState<MapPin[]>([]);
  const [nearMe, setNearMe] = useState(false);
  const [nearCoords, setNearCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [nearLoading, setNearLoading] = useState(false);
  const [placeHint, setPlaceHint] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const skipUrlHydrate = useRef(true);
  const profilePrefsRef = useRef<A11yPreferenceKey[]>([]);
  profilePrefsRef.current = profilePrefs;
  const prefOverridesOffRef = useRef<string[]>([]);
  prefOverridesOffRef.current = prefOverridesOff;

  useEffect(() => {
    setDiscoveryViewMode(discoveryView);
  }, []);

  useEffect(() => {
    const fromUrlQ = searchParams.get("q");
    const fromUrlView = parseDiscoveryView(searchParams.get("view"));
    const hasUrlState =
      fromUrlQ != null ||
      searchParams.has("features") ||
      searchParams.has("audited") ||
      searchParams.has("room") ||
      fromUrlView != null;
    if (hasUrlState) {
      const prefs = readA11yPreferences();
      setProfilePrefs(prefs);
      if (searchParams.has("features")) {
        setPrefOverridesOff(overridesFromFeatures(boot.filters.features, prefs));
      } else if (prefs.length > 0) {
        setPrefOverridesOff([]);
        setFilters((prev) => ({
          ...prev,
          features: featuresFromPrefs(prefs, extrasFromFeatures(prev.features, prefs), []),
        }));
      }
      return;
    }

    const session = readSearchSession();
    if (session) {
      setQuery(session.query);
      const prefs = readA11yPreferences();
      setProfilePrefs(prefs);
      const extras = extrasFromFeatures(session.filters.features, prefs);
      const overrides =
        session.prefOverridesOff ??
        (session.filters.features.length > 0
          ? overridesFromFeatures(session.filters.features, prefs)
          : []);
      setPrefOverridesOff(overrides);
      setFilters({
        ...session.filters,
        features: featuresFromPrefs(prefs, extras, overrides),
      });
      setPage(session.page);
      setDiscoveryView(session.view);
      setDiscoveryViewMode(session.view);
      return;
    }

    const prefs = readA11yPreferences();
    setProfilePrefs(prefs);
    if (prefs.length > 0) {
      setPrefOverridesOff([]);
      setFilters((prev) => ({
        ...prev,
        features: featuresFromPrefs(prefs, extrasFromFeatures(prev.features, prefs), []),
      }));
    }

    const storedView = getDiscoveryViewMode();
    if (storedView !== "map") {
      setDiscoveryView(storedView);
      setDiscoveryViewMode(storedView);
    }
  }, []);

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
    setPrefOverridesOff(overridesFromFeatures(nextFilters.features, profilePrefsRef.current));
    setPage(1);
    if (nextView) {
      setDiscoveryView(nextView);
      setDiscoveryViewMode(nextView);
    }
  }, [searchParams]);

  useEffect(() => {
    writeSearchSession({ query, filters, page, view: discoveryView, prefOverridesOff });
  }, [query, filters, page, discoveryView, prefOverridesOff]);

  useEffect(() => {
    return subscribeA11yPreferences(() => {
      const prefs = readA11yPreferences();
      const previousPrefs = profilePrefsRef.current;
      const nextOverrides = prefOverridesOffRef.current.filter((key) =>
        prefs.includes(key as A11yPreferenceKey)
      );
      setProfilePrefs(prefs);
      setPrefOverridesOff(nextOverrides);
      setFilters((prev) => ({
        ...prev,
        features: featuresFromPrefs(
          prefs,
          extrasFromFeatures(prev.features, previousPrefs),
          nextOverrides
        ),
      }));
    });
  }, []);

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

  const hasActiveSearch = !nearMe && hasExplicitSearch(query, filters, profilePrefs);

  useEffect(() => {
    setPage(1);
  }, [query, filters, mapDataNodeUrl, nearMe]);

  const runNearMe = useCallback(async () => {
    if (!nearCoords) return;
    setNearLoading(true);
    setSearchError("");
    try {
      const peer = await resolvePeerNode(homeNodeUrl, nearCoords.lat, nearCoords.lon);
      const resolved = dataNodeFromResolve(peer, homeNodeUrl);
      const node = toClientNodeUrl(resolved.url);
      setMapDataNodeUrl(node);
      const properties = await fetchNearbyProperties(
        node,
        nearCoords.lat,
        nearCoords.lon,
        NEAR_ME_RADIUS_KM
      );
      setResults(properties);
      setTotal(properties.length);
      if (isConfirmedUncovered(resolved.matched, properties.length)) {
        setSearchError(t("ui.regionNotCovered"));
      }
    } catch {
      setSearchError(t("ui.regionUnreachable"));
      setResults(null);
      setTotal(0);
    } finally {
      setNearLoading(false);
    }
  }, [nearCoords, homeNodeUrl, t]);

  const startNearMe = useCallback(() => {
    setDiscoveryView("map");
    setDiscoveryViewMode("map");
    setSearchError("");
    setGeoError("");
    setNearLoading(true);
    // Keep browse map mounted until GPS succeeds (nearMe would hide viewport pins).
    void requestUserLocation().then(async (result) => {
      if (!result.ok) {
        setNearLoading(false);
        setNearMe(false);
        setNearCoords(null);
        setResults(null);
        setTotal(0);
        setGeoError(
          result.reason === "denied"
            ? t("ui.nearbyGpsDenied")
            : result.reason === "unsupported"
              ? t("ui.gpsUnsupported")
              : result.reason === "insecure"
                ? t("ui.nearbyGpsInsecure")
                : t("ui.nearbyGpsTimeout")
        );
        return;
      }

      setQuery("");
      setPlaceHint(null);
      setNearMe(true);
      setNearCoords(result.coords);
      setResults(null);
      setTotal(0);
      // nearLoading stays true until runNearMe finishes via the effect below.
    });
  }, [t]);

  const browseThisArea = useCallback(() => {
    setQuery("");
    setPlaceHint(null);
    setNearMe(false);
    setNearCoords(null);
    setResults(null);
    setTotal(0);
    setSearchError("");
    setGeoError("");
    setPrefOverridesOff([]);
    setFilters((prev) => ({
      ...prev,
      location: "",
      audited: null,
      hasAccessibleRoom: null,
      features: featuresFromPrefs(profilePrefsRef.current, [], []),
    }));
  }, []);

  useEffect(() => {
    if (!nearMe || !nearCoords || !active) return;
    void runNearMe();
  }, [nearMe, nearCoords, active, runNearMe]);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    if (nearMe) return;
    if (!hasActiveSearch) {
      setResults(null);
      setTotal(0);
      setLoading(false);
      setSearchError("");
      setPlaceHint(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        let searchQ = query;
        let searchFilters = filters;
        if (looksLikePlaceQuery(query) && filters.location.trim() === "") {
          const place = await geocodePlace(query, controller.signal);
          if (controller.signal.aborted) return;
          if (place) {
            setPlaceHint(place.locationLabel);
            searchQ = "";
            searchFilters = { ...filters, location: place.locationLabel };
          } else {
            setPlaceHint(null);
          }
        } else {
          setPlaceHint(null);
        }

        const data = await searchProperties(mapDataNodeUrl, searchQ, searchFilters, controller.signal, {
          page,
          pageSize: SEARCH_PAGE_SIZE,
        });
        if (controller.signal.aborted) return;
        const ranked = [...data.properties].sort((a, b) => {
          const ac = a.facts?.length ?? 0;
          const bc = b.facts?.length ?? 0;
          return bc - ac;
        });
        setResults(ranked);
        setTotal(data.total);
      } catch (e) {
        if (controller.signal.aborted || (e as Error).name === "AbortError") return;
        setSearchError(t("ui.regionUnreachable"));
        setResults(null);
        setTotal(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, filters, mapDataNodeUrl, hasActiveSearch, page, t, nearMe]);

  const browseListProperties = useMemo(
    () => mapPinsToSummaries(viewportPins),
    [viewportPins]
  );
  const displayProperties: PropertySummary[] =
    nearMe || hasActiveSearch ? (results ?? []) : browseListProperties;
  const totalPages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
  const rangeFrom = total === 0 ? 0 : (page - 1) * SEARCH_PAGE_SIZE + 1;
  const rangeTo = Math.min(page * SEARCH_PAGE_SIZE, total);
  const showLoading = nearMe ? nearLoading : hasActiveSearch ? loading : false;

  const emptyState =
    nearMe || hasActiveSearch ? (
      results !== null && results.length === 0 && !showLoading ? (
        <div className="fk-empty">
          <span className="fk-empty-icon">🔍</span>
          <p className="fk-empty-title">{t("ui.searchNoResults")}</p>
          <p className="fk-empty-body">
            {nearMe
              ? t("ui.nearbyNothing", { km: NEAR_ME_RADIUS_KM })
              : query.trim()
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

  const showResultsMeta =
    Boolean(placeHint) ||
    Boolean(geoError) ||
    (nearMe && Boolean(nearCoords)) ||
    (hasActiveSearch && results !== null && !loading);

  return (
    <div className="tab-content fk-search-tab">
      <AccessPageHero notifyNodeUrl={homeNodeUrl}>
        <div className="fk-search-header">
          <PropertySearchBar
            query={query}
            onQueryChange={(q) => {
              setQuery(q);
              if (nearMe) setNearMe(false);
            }}
            filters={filters}
            onFiltersChange={(f) => {
              setPrefOverridesOff(overridesFromFeatures(f.features, profilePrefs));
              setFilters(f);
              if (nearMe) setNearMe(false);
            }}
            searchFeatures={searchFeatures}
            preferenceKeys={profilePrefs}
            alwaysShowFilters
          />
        </div>
      </AccessPageHero>

      <PropertyDiscoveryView
        properties={displayProperties}
        loading={showLoading}
        error={searchError}
        homeNodeUrl={homeNodeUrl}
        propertyNodeUrl={mapDataNodeUrl}
        active={active}
        emptyState={emptyState}
        mapAutoFit={nearMe || hasActiveSearch}
        returnState={returnState}
        onViewModeChange={setDiscoveryView}
        initialViewMode={discoveryView}
        viewportBrowse={!hasActiveSearch && !nearMe}
        viewportFeatureFilters={hasActiveSearch || nearMe ? [] : filters.features}
        onDataNodeUrlChange={setMapDataNodeUrl}
        onViewportPinsChange={setViewportPins}
        userLocation={nearMe ? nearCoords : null}
        radiusKm={nearMe && nearCoords ? NEAR_ME_RADIUS_KM : null}
        onLocateMe={startNearMe}
        locateLoading={nearLoading}
        locateLabel={
          nearCoords
            ? t("ui.nearbySearchingRadius", { km: NEAR_ME_RADIUS_KM })
            : t("ui.nearbyRequestingAccess")
        }
        onBrowseThisArea={browseThisArea}
        listTitle={
          (nearMe || hasActiveSearch) && results && results.length > 0
            ? t("ui.topAccessibleStays")
            : undefined
        }
        resultsMeta={
          showResultsMeta ? (
            <div className="fk-discovery-meta">
              {geoError && (
                <p className="fk-discovery-meta__notice fk-discovery-meta__notice--err" role="alert">
                  {geoError}{" "}
                  <button type="button" className="fk-discovery-meta__retry" onClick={startNearMe}>
                    {t("ui.nearbyRetryLocation")}
                  </button>
                </p>
              )}
              {nearMe && nearCoords && !geoError && (
                <p className="fk-discovery-meta__place" role="status">
                  {t("ui.nearbyActiveRadius", { km: NEAR_ME_RADIUS_KM })}
                </p>
              )}
              {placeHint && (
                <p className="fk-discovery-meta__place" role="status">
                  {t("ui.searchPlaceFilter", { place: placeHint })}
                </p>
              )}
              {hasActiveSearch && results !== null && !loading && (
                <div className="fk-discovery-meta__row">
                  <p className="fk-discovery-meta__count">
                    {total === 1
                      ? t("ui.searchSingleProperty")
                      : t("ui.searchShowingRange", {
                          from: rangeFrom,
                          to: rangeTo,
                          total,
                        })}
                  </p>
                  {totalPages > 1 && (
                    <div className="fk-discovery-meta__pages">
                      <button
                        type="button"
                        disabled={page <= 1 || loading}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        {t("ui.adminPrevPage")}
                      </button>
                      <span>{t("ui.adminPageOf", { page, total: totalPages })}</span>
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
              )}
              {hasActiveSearch && results !== null && !loading && total > SEARCH_PAGE_SIZE && (
                <p className="fk-discovery-meta__notice" role="status">
                  {t("ui.searchPaginationNotice", {
                    total,
                    pageSize: SEARCH_PAGE_SIZE,
                    page,
                    totalPages,
                  })}
                </p>
              )}
            </div>
          ) : null
        }
      />
    </div>
  );
}
