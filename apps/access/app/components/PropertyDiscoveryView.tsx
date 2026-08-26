"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { getTierStyle, useLocale, type PropertyFact, type PropertySummary } from "@wikitraveler/ui";
import { RegionMap } from "./RegionMap";
import type { MapPin } from "../lib/accessApi";
import { propertyHref } from "../lib/propertyHref";
import { saveAccessReturn, type AccessReturnState } from "../lib/navigationReturn";
import { useSavedPlaceIds } from "../lib/savedPlaces";
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
  /** Browse without a search query: viewport-scoped pins + coverage (RFC-0002 M3). */
  viewportBrowse?: boolean;
  onDataNodeUrlChange?: (url: string) => void;
  /** Viewport browse pins for list mode (map → list). */
  onViewportPinsChange?: (pins: MapPin[]) => void;
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
  onDataNodeUrlChange,
  onViewportPinsChange,
}: Props) {
  const { t, getTierLabel } = useLocale();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<DiscoveryViewMode>("map");
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

  const pins: MapPin[] = useMemo(() => pinsFromSummaries(properties), [properties]);
  const hasMap = pins.length > 0 || userLocation != null || viewportBrowse;

  // Reset the lazy-render window whenever the result set changes.
  useEffect(() => {
    setVisibleCount(LIST_PAGE_SIZE);
  }, [properties]);

  const showList = viewMode === "list";
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
    if (!id) return;
    const el = itemRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  const handleMapSelect = useCallback(
    (pin: MapPin | null) => {
      handleSelect(pin?.id ?? null);
    },
    [handleSelect]
  );

  function changeViewMode(mode: DiscoveryViewMode) {
    setViewMode(mode);
    setDiscoveryViewMode(mode);
    onViewModeChange?.(mode);
  }

  const showMap = viewMode === "map";

  return (
    <div className="fk-discovery">
      {headerExtra}

      {showViewModeToggle && (
        <div className="fk-discovery-view-toggle" role="tablist" aria-label={t("ui.discoveryViewMode")}>
          {(["map", "list"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={viewMode === mode}
              className={`fk-discovery-view-btn${viewMode === mode ? " fk-discovery-view-btn--active" : ""}`}
              onClick={() => changeViewMode(mode)}
            >
              {mode === "map" ? t("ui.discoveryViewMap") : t("ui.discoveryViewList")}
            </button>
          ))}
        </div>
      )}

      {hasMap ? (
        <div
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
            onSelectProperty={handleMapSelect}
            userLocation={userLocation}
            radiusKm={radiusKm}
            savedIds={savedIds}
            interactionMode="select"
            autoFit={mapAutoFit}
            viewportBrowse={viewportBrowse}
            onDataNodeUrlChange={onDataNodeUrlChange}
            onViewportPinsChange={onViewportPinsChange}
          />
        </div>
      ) : (
        showMap &&
        !loading &&
        properties.length > 0 && (
          <p className="status-muted fk-discovery-map-unavailable">{t("ui.discoveryMapUnavailable")}</p>
        )
      )}

      {showList && (
        <div className="fk-discovery-list" ref={listRef}>
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
                    className={`fk-disco-item${selected ? " fk-disco-item--selected" : ""}${saved ? " fk-disco-item--saved" : ""}`}
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
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M6 2h12a1 1 0 0 1 1 1v18l-7-4-7 4V3a1 1 0 0 1 1-1z" />
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
                          handleSelect(property.id);
                          changeViewMode("map");
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
