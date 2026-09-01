"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme, useLocale } from "@wikitraveler/ui";
import {
  fetchMapPins,
  MapPinsError,
  resolvePeerNode,
  toClientNodeUrl,
  type MapPin,
} from "../lib/accessApi";
import { filterPinsByFeatures } from "../lib/mapPinFeatures";
import { readMapCamera, saveMapCamera } from "../lib/mapCameraSession";
import { dataNodeFromResolve, isConfirmedUncovered } from "../lib/peerCoverage";

/** Below this zoom, no property pins — ask the traveler to zoom in. */
export const MAP_PIN_MIN_ZOOM = 10;

type MapMarker = import("leaflet").Marker | import("leaflet").CircleMarker;

interface UserLocation {
  lat: number;
  lon: number;
}

interface Props {
  nodeUrl: string;
  homeNodeUrl: string;
  active: boolean;
  /** External pins — when set, internal/viewport fetch is skipped. */
  pins?: MapPin[];
  loading?: boolean;
  error?: string;
  selectedPropertyId?: string | null;
  onSelectProperty?: (pin: MapPin | null) => void;
  userLocation?: UserLocation | null;
  radiusKm?: number | null;
  savedIds?: Set<string>;
  autoFit?: boolean;
  className?: string;
  /** RFC-0002 M3: fetch pins for the visible bbox; message when zoomed out. */
  viewportBrowse?: boolean;
  /** Notify parent when viewport resolve picks a data node (for list links). */
  onDataNodeUrlChange?: (url: string) => void;
  /** Viewport browse: current pins for list mode. */
  onViewportPinsChange?: (pins: MapPin[]) => void;
  /** Viewport browse: keep only pins matching these boolean features (profile chips). */
  viewportFeatureFilters?: readonly string[];
  /** When false, keep the Leaflet instance but hide the shell (preserves zoom). */
  visible?: boolean;
  /** GPS locate control — pan/zoom to user and notify parent (Near me). */
  onLocateMe?: () => void;
  locateLoading?: boolean;
  /** Clear the typed search so this map can browse the visible area. */
  onBrowseThisArea?: () => void;
}

function getTileConfig() {
  // OSM tiles stay free without an API key. Dark mode uses a CSS filter on the
  // tile pane (see globals.css) instead of Carto basemaps that watermark “API KEY REQUIRED”.
  return {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  };
}

function radiusForZoom(zoom: number, selected: boolean): number {
  let base: number;
  if (zoom <= 6) base = 5;
  else if (zoom <= 8) base = 6;
  else if (zoom <= 10) base = 7;
  else if (zoom <= 12) base = 8;
  else base = 10;
  return selected ? base + 3 : base;
}

const PIN_COLOR = { color: "#1e40af", fillColor: "#60a5fa" };
const PIN_COLOR_DARK = { color: "#3b82f6", fillColor: "#60a5fa" };

function pinMarkerStyle(
  themeMode: string,
  selected: boolean,
  zoom: number
): import("leaflet").CircleMarkerOptions {
  const dark = themeMode === "dark";
  const colors = dark ? PIN_COLOR_DARK : PIN_COLOR;
  return {
    radius: radiusForZoom(zoom, selected),
    ...colors,
    fillOpacity: 0.9,
    weight: selected ? 4 : 2,
  };
}

const HEART_SVG =
  '<svg class="wt-map-pin__heart-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

function savedPinIcon(L: typeof import("leaflet"), selected: boolean) {
  const size = selected ? 30 : 24;
  return L.divIcon({
    className: `wt-map-pin wt-map-pin--saved${selected ? " wt-map-pin--selected" : ""}`,
    html: `<span class="wt-map-pin__heart">${HEART_SVG}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function formatBoundsBbox(b: import("leaflet").LatLngBounds): string {
  return `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
}

function safeFitToPins(
  map: import("leaflet").Map,
  group: import("leaflet").FeatureGroup,
  pins: MapPin[],
  userLocation?: UserLocation | null
) {
  const validPins = pins.filter((p) => p.lat !== 0 && p.lon !== 0);
  if (validPins.length === 0 && userLocation) {
    map.setView([userLocation.lat, userLocation.lon], 14);
    return;
  }
  if (validPins.length === 0) return;
  try {
    if (validPins.length === 1 && !userLocation) {
      map.setView([validPins[0].lat, validPins[0].lon], 14);
      return;
    }
    const bounds = group.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    }
  } catch {
    // Map container may be hidden or mid-teardown.
  }
}

function destroyMap(
  mapRef: React.MutableRefObject<import("leaflet").Map | null>,
  layerGroupRef: React.MutableRefObject<import("leaflet").FeatureGroup | null>,
  userLayerRef: React.MutableRefObject<import("leaflet").LayerGroup | null>,
  tileLayerRef: React.MutableRefObject<import("leaflet").TileLayer | null>,
  leafletRef: React.MutableRefObject<typeof import("leaflet") | null>,
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  if (mapRef.current) {
    mapRef.current.remove();
    mapRef.current = null;
  }
  layerGroupRef.current = null;
  userLayerRef.current = null;
  tileLayerRef.current = null;
  leafletRef.current = null;
  if (containerRef.current) {
    delete (containerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
  }
}

function persistMapCamera(map: import("leaflet").Map) {
  const center = map.getCenter();
  saveMapCamera({ lat: center.lat, lon: center.lng, zoom: map.getZoom() });
}


export function RegionMap({
  nodeUrl,
  homeNodeUrl,
  active,
  pins: externalPins,
  loading: externalLoading,
  error: externalError,
  selectedPropertyId = null,
  onSelectProperty,
  userLocation = null,
  radiusKm = null,
  savedIds,
  autoFit = true,
  className,
  viewportBrowse = false,
  viewportFeatureFilters = [],
  onDataNodeUrlChange,
  onViewportPinsChange,
  visible = true,
  onLocateMe,
  locateLoading = false,
  onBrowseThisArea,
}: Props) {
  const { mode } = useTheme();
  const { t } = useLocale();
  const [internalPins, setInternalPins] = useState<MapPin[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [zoomHint, setZoomHint] = useState(false);
  const [areaDirty, setAreaDirty] = useState(false);
  const initialViewportSearchDone = useRef(false);
  const [coverageHint, setCoverageHint] = useState(false);

  const homeNodeUrlRef = useRef(homeNodeUrl);
  const dataNodeUrlRef = useRef(nodeUrl);
  homeNodeUrlRef.current = homeNodeUrl;
  dataNodeUrlRef.current = nodeUrl;

  const useExternal = externalPins !== undefined && !viewportBrowse;
  const visibleInternalPins = useMemo(
    () => filterPinsByFeatures(internalPins, viewportFeatureFilters),
    [internalPins, viewportFeatureFilters]
  );
  const pins = useExternal ? (externalPins ?? []) : visibleInternalPins;
  const loading = useExternal ? (externalLoading ?? false) : internalLoading;
  const error = useExternal ? (externalError ?? "") : internalError;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerGroupRef = useRef<import("leaflet").FeatureGroup | null>(null);
  const userLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const markerByIdRef = useRef<Map<string, MapMarker>>(new Map());
  const pinsRef = useRef<MapPin[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const savedIdsRef = useRef<Set<string>>(new Set());
  const lastFitSignatureRef = useRef<string | null>(null);
  const suppressAreaDirtyRef = useRef(false);
  const pendingViewportRefreshRef = useRef(false);
  const wasViewportBrowseRef = useRef(viewportBrowse);
  const updateRadiiRef = useRef<(() => void) | null>(null);
  const viewportFetchRef = useRef(0);
  const onSelectPropertyRef = useRef(onSelectProperty);
  onSelectPropertyRef.current = onSelectProperty;

  pinsRef.current = pins;
  selectedIdRef.current = selectedPropertyId;
  savedIdsRef.current = savedIds ?? new Set();

  useEffect(() => {
    if (!viewportBrowse) {
      onViewportPinsChange?.([]);
      return;
    }
    onViewportPinsChange?.(visibleInternalPins);
  }, [viewportBrowse, visibleInternalPins, onViewportPinsChange]);

  const refreshViewport = useCallback(async () => {
    if (!viewportBrowse || useExternal) return;
    const map = mapRef.current;
    if (!map) return;

    const zoom = map.getZoom();
    if (zoom < MAP_PIN_MIN_ZOOM) {
      setZoomHint(true);
      setAreaDirty(false);
      setCoverageHint(false);
      setInternalPins([]);
      setInternalError("");
      setInternalLoading(false);
      return;
    }

    setZoomHint(false);
    const bounds = map.getBounds();
    const bbox = formatBoundsBbox(bounds);
    const center = map.getCenter();
    const fetchId = ++viewportFetchRef.current;
    setInternalLoading(true);
    setInternalError("");

    try {
      const peer = await resolvePeerNode(homeNodeUrlRef.current, center.lat, center.lng);
      if (fetchId !== viewportFetchRef.current) return;

      const resolved = dataNodeFromResolve(peer, homeNodeUrlRef.current);
      const dataUrl = toClientNodeUrl(resolved.url);
      dataNodeUrlRef.current = dataUrl;
      onDataNodeUrlChange?.(dataUrl);

      const nextPins = await fetchMapPins(dataUrl, { bbox, signal: AbortSignal.timeout(12_000) });
      if (fetchId !== viewportFetchRef.current) return;
      setInternalPins(nextPins);
      setCoverageHint(isConfirmedUncovered(resolved.matched, nextPins.length));
    } catch (e) {
      if (fetchId !== viewportFetchRef.current) return;
      if (e instanceof MapPinsError && e.code === "BBOX_TOO_LARGE") {
        setZoomHint(true);
        setAreaDirty(false);
        setInternalPins([]);
        setInternalError("");
      } else {
        setInternalError(t("ui.regionUnreachable"));
        setInternalPins([]);
      }
    } finally {
      if (fetchId === viewportFetchRef.current) setInternalLoading(false);
    }
  }, [viewportBrowse, useExternal, onDataNodeUrlChange, t]);

  // Legacy internal fetch (non-viewport): load region=1 style not available on peers —
  // callers should pass external pins or use viewportBrowse.
  useEffect(() => {
    if (useExternal || viewportBrowse || !active) return;
    setInternalPins([]);
    setInternalError(t("ui.mapZoomToSeePlaces"));
    setInternalLoading(false);
  }, [active, useExternal, viewportBrowse, t]);

  useEffect(() => {
    if (!active) {
      destroyMap(
        mapRef,
        layerGroupRef,
        userLayerRef,
        tileLayerRef,
        leafletRef,
        containerRef
      );
      lastFitSignatureRef.current = null;
      initialViewportSearchDone.current = false;
      setMapReady(false);
      return;
    }
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      leafletRef.current = L;
      const restored = readMapCamera();
      let initialCenter: [number, number];
      let initialZoom: number;
      if (restored) {
        initialCenter = [restored.lat, restored.lon];
        initialZoom = restored.zoom;
      } else if (userLocation) {
        initialCenter = [userLocation.lat, userLocation.lon];
        initialZoom = 12;
      } else {
        initialCenter = [52.3, 5.3];
        initialZoom = viewportBrowse ? 6 : 7;
      }
      const map = L.map(containerRef.current, { preferCanvas: true }).setView(
        initialCenter,
        initialZoom
      );
      mapRef.current = map;

      const { url, attribution } = getTileConfig();
      tileLayerRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map);

      layerGroupRef.current = L.featureGroup().addTo(map);
      userLayerRef.current = L.layerGroup().addTo(map);

      map.on("zoomend", () => {
        updateRadiiRef.current?.();
        persistMapCamera(map);
      });
      map.on("moveend", () => persistMapCamera(map));

      requestAnimationFrame(() => {
        if (!mapRef.current) return;
        map.invalidateSize();
      });

      setMapReady(true);
    });

    return () => {
      cancelled = true;
      destroyMap(
        mapRef,
        layerGroupRef,
        userLayerRef,
        tileLayerRef,
        leafletRef,
        containerRef
      );
      lastFitSignatureRef.current = null;
      initialViewportSearchDone.current = false;
      setMapReady(false);
    };
  }, [active, userLocation, viewportBrowse]);

  useEffect(() => {
    if (!visible || !mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    requestAnimationFrame(() => {
      map.invalidateSize();
    });
  }, [visible, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const syncChromeAfterMove = () => {
      persistMapCamera(map);
      if (suppressAreaDirtyRef.current) {
        suppressAreaDirtyRef.current = false;
        setAreaDirty(false);
        return;
      }
      const zoom = map.getZoom();
      if (zoom < MAP_PIN_MIN_ZOOM) {
        setZoomHint(true);
        setAreaDirty(false);
        setCoverageHint(false);
        if (viewportBrowse) setInternalPins([]);
        return;
      }
      setZoomHint(false);
      if (initialViewportSearchDone.current || !viewportBrowse) {
        setAreaDirty(true);
      }
    };

    map.on("moveend", syncChromeAfterMove);
    map.on("zoomend", syncChromeAfterMove);

    return () => {
      map.off("moveend", syncChromeAfterMove);
      map.off("zoomend", syncChromeAfterMove);
    };
  }, [mapReady, viewportBrowse]);

  useEffect(() => {
    if (!mapReady || !viewportBrowse || useExternal) return;

    const enteredBrowse = !wasViewportBrowseRef.current;
    wasViewportBrowseRef.current = true;

    if (pendingViewportRefreshRef.current) {
      pendingViewportRefreshRef.current = false;
      initialViewportSearchDone.current = true;
      void refreshViewport().then(() => setAreaDirty(false));
      return;
    }

    if (!initialViewportSearchDone.current) {
      initialViewportSearchDone.current = true;
      if (enteredBrowse) {
        setAreaDirty(true);
        return;
      }
      void refreshViewport().then(() => setAreaDirty(false));
      return;
    }

    if (enteredBrowse) {
      setAreaDirty(true);
    }
  }, [mapReady, viewportBrowse, useExternal, refreshViewport]);

  useEffect(() => {
    if (!viewportBrowse) wasViewportBrowseRef.current = false;
  }, [viewportBrowse]);

  function renderMarkers() {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = layerGroupRef.current;
    const userGroup = userLayerRef.current;
    if (!L || !map || !group || !userGroup) return;

    group.clearLayers();
    userGroup.clearLayers();
    markerByIdRef.current.clear();

    const zoom = map.getZoom();
    const savedSet = savedIdsRef.current;

    const sorted = [...pinsRef.current]
      .filter((p) => p.lat !== 0 && p.lon !== 0)
      .sort((a, b) => {
        const aSaved = savedSet.has(a.id) ? 1 : 0;
        const bSaved = savedSet.has(b.id) ? 1 : 0;
        if (aSaved !== bSaved) return aSaved - bSaved;
        return a.id.localeCompare(b.id);
      });

    for (const pin of sorted) {
      const selected = pin.id === selectedIdRef.current;
      const saved = savedSet.has(pin.id);
      const marker: MapMarker = saved
        ? L.marker([pin.lat, pin.lon], { icon: savedPinIcon(L, selected), zIndexOffset: 400 })
        : L.circleMarker([pin.lat, pin.lon], pinMarkerStyle(mode, selected, zoom));
      marker.on("click", () => {
        if (selectedIdRef.current === pin.id) {
          onSelectPropertyRef.current?.(null);
        } else {
          onSelectPropertyRef.current?.(pin);
        }
      });
      marker.addTo(group);
      markerByIdRef.current.set(pin.id, marker);
    }

    updateRadiiRef.current = () => {
      const m = mapRef.current;
      if (!m) return;
      const z = m.getZoom();
      markerByIdRef.current.forEach((marker, id) => {
        if (!("setRadius" in marker)) return;
        (marker as import("leaflet").CircleMarker).setRadius(
          radiusForZoom(z, id === selectedIdRef.current)
        );
      });
    };

    if (userLocation) {
      L.circleMarker([userLocation.lat, userLocation.lon], {
        radius: 9,
        color: "#7c3aed",
        fillColor: "#a78bfa",
        fillOpacity: 1,
        weight: 3,
      }).addTo(userGroup);

      if (radiusKm != null && radiusKm > 0) {
        L.circle([userLocation.lat, userLocation.lon], {
          radius: radiusKm * 1000,
          color: "#7c3aed",
          fillColor: "#7c3aed",
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: "4 6",
        }).addTo(userGroup);
      }
    }

    // Do not re-zoom on marker rebuild — that fights user zoom-out.
    if (viewportBrowse) return;

    const fitSignature = `${sorted.map((p) => p.id).join(",")}|${userLocation ? `${userLocation.lat},${userLocation.lon}` : ""}|${radiusKm ?? ""}`;
    if (autoFit && fitSignature !== lastFitSignatureRef.current) {
      lastFitSignatureRef.current = fitSignature;
      suppressAreaDirtyRef.current = true;
      requestAnimationFrame(() => {
        if (!mapRef.current || !layerGroupRef.current) return;
        safeFitToPins(map, group, pinsRef.current, userLocation);
      });
    }
  }

  useEffect(() => {
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, mode, selectedPropertyId, userLocation, radiusKm, savedIds, onSelectProperty, autoFit, mapReady, t, viewportBrowse]);

  const showMapShell = viewportBrowse || pins.length > 0 || useExternal;

  return (
    <div className={className ? `fk-map-tab ${className}` : "fk-map-tab"}>
      {loading && pins.length === 0 && !viewportBrowse && (
        <div className="fk-discovery-skeleton fk-discovery-skeleton--map" aria-hidden="true" />
      )}

      {error && (
        <p className={`status-err${showMapShell ? " fk-map-inline-error" : ""}`} role="alert">
          {error}
        </p>
      )}

      {coverageHint && viewportBrowse && !zoomHint && (
        <p className="status-muted fk-map-coverage-hint" role="status">
          {t("ui.regionNotCovered")} — {t("ui.regionNotCoveredHint")}
        </p>
      )}

      {!loading && !error && !viewportBrowse && pins.length === 0 && (
        <div className="fk-empty" style={{ paddingTop: 32 }}>
          <span className="fk-empty-icon">🗺️</span>
          <p className="fk-empty-title">{t("ui.regionEmptyMap")}</p>
        </div>
      )}

      {showMapShell && (
        <div className="wt-map-frame fk-map-frame">
          {zoomHint && viewportBrowse && (
            <p className="fk-map-zoom-hint" role="status">
              {t("ui.mapZoomToSeePlaces")}
            </p>
          )}
          {loading && (
            <div className="fk-map-loading-overlay" role="status" aria-live="polite">
              <span className="fk-map-loading-spinner" aria-hidden="true" />
              <span className="fk-map-loading-label">{t("ui.searchingArea")}</span>
            </div>
          )}
          {!loading && locateLoading && (
            <div className="fk-map-loading-overlay fk-map-loading-overlay--locate" role="status" aria-live="polite">
              <span className="fk-map-loading-spinner" aria-hidden="true" />
              <span className="fk-map-loading-label">{t("ui.locatingYou")}</span>
            </div>
          )}
          {(viewportBrowse || onBrowseThisArea) && areaDirty && !zoomHint && !loading && !locateLoading && (
            <button
              type="button"
              className="fk-map-search-area-btn"
              onClick={() => {
                if (viewportBrowse) {
                  void refreshViewport().then(() => setAreaDirty(false));
                  return;
                }
                pendingViewportRefreshRef.current = true;
                onBrowseThisArea?.();
              }}
            >
              {t("ui.searchThisArea")}
            </button>
          )}
          {onLocateMe && (
            <button
              type="button"
              className="fk-map-locate-btn"
              onClick={onLocateMe}
              disabled={locateLoading}
              title={t("ui.searchNearMe")}
              aria-label={t("ui.searchNearMe")}
            >
              {locateLoading ? (
                <span className="fk-map-loading-spinner fk-map-loading-spinner--sm" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  <circle cx="12" cy="12" r="8" />
                </svg>
              )}
            </button>
          )}
          <div
            ref={containerRef}
            role="application"
            aria-label={t("ui.mapViewProperty")}
            className="wt-map-container fk-map-container"
          />
        </div>
      )}
    </div>
  );
}
