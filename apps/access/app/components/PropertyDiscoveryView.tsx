"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { getTierStyle, useLocale, type PropertyFact, type PropertySummary } from "@wikitraveler/ui";
import { RegionMap } from "./RegionMap";
import type { MapPin } from "../lib/accessApi";
import { propertyHref } from "../lib/propertyHref";
import { saveAccessReturn, type AccessReturnState } from "../lib/navigationReturn";
import { useSavedPlaceIds } from "../lib/useSavedPlaceIds";
import { AccessibilityIconRow } from "./AccessibilityIconRow";
import { PropertyMapPreview } from "./PropertyMapPreview";
import {
  getDiscoveryViewMode,
  pinsFromSummaries,
  propertySummaryToMapPin,
  setDiscoveryViewMode,
  type DiscoveryViewMode,
} from "../lib/discoveryUtils";

const TIER_RANK: Record<string, number> = {
  OFFICIAL: 0,
  AI_GUESS: 1,
  VERIFIED: 2,
  CONFIRMED: 3,
};

/** How many list rows to render per lazy-load batch. */
const LIST_PAGE_SIZE = 24;

/** Summarise accessibility facts into a single count + best confidence tier. */
function accessibilitySummary(
  facts: PropertyFact[] | undefined
): { count: number; tier: string } | null {
  if (!facts || facts.length === 0) return null;
  const best = new Map<string, PropertyFact>();
  for (const f of facts) {
    const existing = best.get(f.fieldName);
    if (!existing || (TIER_RANK[f.tier] ?? 0) > (TIER_RANK[existing.tier] ?? 0)) {
      best.set(f.fieldName, f);
    }
  }
  let topTier = "OFFICIAL";
  for (const f of best.values()) {
    if ((TIER_RANK[f.tier] ?? 0) > (TIER_RANK[topTier] ?? 0)) topTier = f.tier;
  }
  return { count: best.size, tier: topTier };
}

function distanceLabel(distanceM?: number): string | null {
  if (distanceM == null) return null;
  return distanceM < 1000 ? `${Math.round(distanceM)} m` : `${(distanceM / 1000).toFixed(1)} km`;
}

interface UserLocation {
  lat: number;
  lon: number;
}

interface Props {
  properties: PropertySummary[];
  loading?: boolean;
  error?: string;
  homeNodeUrl: string;
  propertyNodeUrl: string;
  active?: boolean;
  userLocation?: UserLocation | null;
  radiusKm?: number | null;
  emptyState?: ReactNode;
  headerExtra?: ReactNode;
  showViewModeToggle?: boolean;
  mapAutoFit?: boolean;
  returnState?: AccessReturnState;
  onViewModeChange?: (mode: DiscoveryViewMode) => void;
  initialViewMode?: DiscoveryViewMode | null;
  /** Browse without a search query: viewport-scoped pins (RFC-0002 M3). */
  viewportBrowse?: boolean;
  /** Feature keys applied to viewport pins (profile chips / browse filters). */
  viewportFeatureFilters?: readonly string[];
  onDataNodeUrlChange?: (url: string) => void;
  /** Viewport browse pins for list mode (map → list). */
  onViewportPinsChange?: (pins: MapPin[]) => void;
  onLocateMe?: () => void;
  locateLoading?: boolean;
  /** Leave a typed search and browse the visible map area. */
  onBrowseThisArea?: () => void;
  /** Compact result counts / place hint / pagination under Map|List tabs. */
  resultsMeta?: ReactNode;
  /** Optional title shown at the top of list mode. */
  listTitle?: string;
}

export function PropertyDiscoveryView({
  properties,
  loading = false,
  error = "",
  homeNodeUrl,
  propertyNodeUrl,
  active = true,
  userLocation = null,
  radiusKm = null,
  emptyState,
  headerExtra,
  showViewModeToggle = true,
  mapAutoFit = true,
  returnState,
  onViewModeChange,
  initialViewMode = null,
  viewportBrowse = false,
  viewportFeatureFilters,
  onDataNodeUrlChange,
  onViewportPinsChange,
  onLocateMe,
  locateLoading = false,
  onBrowseThisArea,
  resultsMeta,
  listTitle,
}: Props) {
  const { t, getTierLabel } = useLocale();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<DiscoveryViewMode>("map");
  const [desktopSplit, setDesktopSplit] = useState(false);
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const savedIds = useSavedPlaceIds();

  useEffect(() => {
    const mode = initialViewMode ?? getDiscoveryViewMode();
    setViewMode(mode);
    setDiscoveryViewMode(mode);
  }, [initialViewMode]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 900px)");
    const sync = () => setDesktopSplit(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const pins: MapPin[] = useMemo(() => pinsFromSummaries(properties), [properties]);
  const hasMap = pins.length > 0 || userLocation != null || viewportBrowse;

  // Reset the lazy-render window whenever the result set changes.
  useEffect(() => {
    setVisibleCount(LIST_PAGE_SIZE);
  }, [properties]);

  const showList = desktopSplit || viewMode === "list";
  const hasMore = visibleCount < properties.length;

  // Grow the rendered window as the sentinel scrolls into view (lazy loading).
  useEffect(() => {
    if (!showList || !hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + LIST_PAGE_SIZE, properties.length));
        }
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [showList, hasMore, visibleCount, properties.length]);

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
    if (!id) {
      setSelectedPin(null);
      return;
    }
    const el = itemRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  const scrollListToId = useCallback(
    (id: string) => {
      const idx = properties.findIndex((p) => p.id === id);
      if (idx >= 0) {
        setVisibleCount((c) => Math.max(c, idx + 1));
      }
      requestAnimationFrame(() => {
        itemRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    },
    [properties]
  );

  const handleMapSelect = useCallback(
    (pin: MapPin | null) => {
      setSelectedPin(pin);
      setSelectedId(pin?.id ?? null);
      if (pin) scrollListToId(pin.id);
    },
    [scrollListToId]
  );

  const closeMapPreview = useCallback(() => {
    setSelectedPin(null);
    setSelectedId(null);
  }, []);

  function changeViewMode(mode: DiscoveryViewMode) {
    setViewMode(mode);
    setDiscoveryViewMode(mode);
    onViewModeChange?.(mode);
  }

  const showMap = desktopSplit || viewMode === "map";

  return (
    <div className={`fk-discovery${desktopSplit ? " fk-discovery--desktop-split" : ""}`}>
      {headerExtra}

      <div className="fk-discovery-chrome">
        {showViewModeToggle && !desktopSplit && (
          <div className="fk-discovery-tabs" role="tablist" aria-label={t("ui.discoveryViewMode")}>
            {(["map", "list"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                id={`discovery-tab-${mode}`}
                aria-selected={viewMode === mode}
                aria-controls={`discovery-panel-${mode}`}
                tabIndex={viewMode === mode ? 0 : -1}
                className={`fk-discovery-tab${viewMode === mode ? " fk-discovery-tab--active" : ""}`}
                onClick={() => changeViewMode(mode)}
              >
                {mode === "map" ? t("ui.discoveryViewMap") : t("ui.discoveryViewList")}
              </button>
            ))}
          </div>
        )}
        {resultsMeta}
      </div>

      <div className="fk-discovery-body">
        {hasMap ? (
          <div
            id="discovery-panel-map"
            role="tabpanel"
            aria-labelledby="discovery-tab-map"
            hidden={!showMap}
            className={showMap ? "fk-discovery-map" : "fk-discovery-map fk-discovery-map--hidden"}
            aria-hidden={!showMap}
          >
            <RegionMap
              nodeUrl={propertyNodeUrl}
              homeNodeUrl={homeNodeUrl}
              active={active}
              visible={showMap}
              pins={viewportBrowse ? undefined : pins}
              loading={loading}
              error={error}
              selectedPropertyId={selectedId}
              hoveredPropertyId={hoveredId}
              onSelectProperty={handleMapSelect}
              userLocation={userLocation}
              radiusKm={radiusKm}
              savedIds={savedIds}
              autoFit={mapAutoFit}
              viewportBrowse={viewportBrowse}
              viewportFeatureFilters={viewportFeatureFilters}
              onDataNodeUrlChange={onDataNodeUrlChange}
              onViewportPinsChange={onViewportPinsChange}
              onLocateMe={onLocateMe}
              locateLoading={locateLoading}
              onBrowseThisArea={onBrowseThisArea}
            />
            {showMap && selectedPin && (
              <PropertyMapPreview
                pin={selectedPin}
                homeNodeUrl={homeNodeUrl}
                propertyNodeUrl={propertyNodeUrl}
                saved={savedIds.has(selectedPin.id)}
                returnState={returnState}
                onClose={closeMapPreview}
              />
            )}
          </div>
        ) : (
          showMap &&
          !loading &&
          properties.length > 0 && (
            <p className="status-muted fk-discovery-map-unavailable">{t("ui.discoveryMapUnavailable")}</p>
          )
        )}

        {showList && (
          <div
            id="discovery-panel-list"
            role="tabpanel"
            aria-labelledby="discovery-tab-list"
            className="fk-discovery-list"
            ref={listRef}
          >
            {listTitle && !loading && properties.length > 0 && (
              <p className="fk-discovery-list-title">{listTitle}</p>
            )}
            {loading && (
              <div className="fk-discovery-skeleton-list" aria-hidden="true">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="fk-discovery-skeleton fk-discovery-skeleton--card" />
                ))}
              </div>
            )}

            {error && <p className="status-err">{error}</p>}

            {!loading && properties.length === 0 && emptyState}

            {!loading && properties.length > 0 && (
              <ul className="fk-discovery-cards" aria-label={t("ui.searchFindProperties")}>
                {properties.slice(0, visibleCount).map((property) => {
                  const selected = selectedId === property.id;
                  const hovered = hoveredId === property.id;
                  const saved = savedIds.has(property.id);
                  const a11y = accessibilitySummary(property.facts);
                  const dist = distanceLabel(property.distanceM);
                  const hasCoords =
                    property.lat != null && property.lon != null && property.lat !== 0;
                  return (
                    <li
                      key={property.id}
                      ref={(el) => {
                        if (el) itemRefs.current.set(property.id, el);
                        else itemRefs.current.delete(property.id);
                      }}
                      className={`fk-disco-item${selected ? " fk-disco-item--selected" : ""}${hovered && !selected ? " fk-disco-item--hovered" : ""}${saved ? " fk-disco-item--saved" : ""}`}
                      onMouseEnter={() => setHoveredId(property.id)}
                      onMouseLeave={() => setHoveredId((id) => (id === property.id ? null : id))}
                    >
                      <Link
                        href={propertyHref(property.id, propertyNodeUrl, homeNodeUrl)}
                        className="fk-disco-item-link"
                        onClick={() => {
                          if (returnState) saveAccessReturn(returnState);
                          handleSelect(property.id);
                        }}
                      >
                        <span className="fk-disco-item-text">
                          <span className="fk-disco-item-head">
                            {saved && (
                              <svg
                                className="fk-disco-item-saved-icon"
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                              </svg>
                            )}
                            <span className="fk-disco-item-name">{property.name}</span>
                          </span>
                          <span className="fk-disco-item-meta">
                            <span className="fk-disco-item-loc">{property.location}</span>
                            {dist && <span className="fk-disco-item-dist">{dist}</span>}
                          </span>
                          <span className="fk-disco-item-a11y">
                            {a11y ? (
                              <span
                                className="fk-disco-a11y-badge"
                                style={getTierStyle(a11y.tier)}
                                title={t("ui.discoveryA11yLevel", {
                                  tier: getTierLabel(a11y.tier),
                                })}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                  <circle cx="12" cy="4" r="2" />
                                  <path d="M6 8h12M12 8v6m0 0l-3 6m3-6l3 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                                </svg>
                                {t("ui.discoveryA11yCount", { count: a11y.count })}
                              </span>
                            ) : (
                              <span className="fk-disco-a11y-none">{t("ui.discoveryA11yNone")}</span>
                            )}
                          </span>
                          <AccessibilityIconRow facts={property.facts} max={4} />
                        </span>
                        <svg
                          className="fk-disco-item-chevron"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="9 6 15 12 9 18" />
                        </svg>
                      </Link>
                      {hasCoords && (
                        <button
                          type="button"
                          className="fk-disco-item-locate"
                          title={t("ui.discoveryShowOnMap")}
                          aria-label={t("ui.discoveryShowOnMap")}
                          onClick={(e) => {
                            e.stopPropagation();
                            const pin = propertySummaryToMapPin(property);
                            setSelectedPin(pin);
                            handleSelect(property.id);
                            if (!desktopSplit) changeViewMode("map");
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {!loading && hasMore && (
              <div ref={sentinelRef} className="fk-discovery-sentinel" aria-hidden="true">
                <span className="fk-discovery-loading-more">
                  {t("ui.discoveryLoadingMore", {
                    shown: visibleCount,
                    total: properties.length,
                  })}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Convert raw map pins to pseudo summaries for list display when only pins are available. */
export function mapPinsToSummaries(pins: MapPin[]): PropertySummary[] {
  return pins.map((pin) => ({
    id: pin.id,
    name: pin.name,
    location: pin.location,
    lat: pin.lat,
    lon: pin.lon,
    facts: Object.entries(pin.facts ?? {}).map(([fieldName, f]) => ({
      fieldName,
      value: f.value,
      tier: f.tier,
    })),
  }));
}

export { propertySummaryToMapPin, pinsFromSummaries };
