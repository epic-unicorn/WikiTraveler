"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme, useLocale } from "@wikitraveler/ui";
import {
  fetchCoverageRegions,
  fetchMapPins,
  MapPinsError,
  resolvePeerNode,
  toClientNodeUrl,
  type CoverageRegion,
  type MapPin,
} from "../lib/accessApi";
import { buildAccessMapPopup, buildAccessMapTooltip } from "../lib/mapPopup";
import { readAuthToken } from "../lib/authStorage";
import { canContribute, roleFromToken } from "../lib/userRole";

/** Below this zoom, show coverage rectangles only (no property pins). */
export const MAP_PIN_MIN_ZOOM = 10;

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
  onSelectProperty?: (pin: MapPin) => void;
  userLocation?: UserLocation | null;
  radiusKm?: number | null;
  savedIds?: Set<string>;
  interactionMode?: "popup" | "select";
  autoFit?: boolean;
  className?: string;
  /** RFC-0002 M3: fetch pins for the visible bbox; coverage at low zoom. */
  viewportBrowse?: boolean;
  /** Notify parent when viewport resolve picks a data node (for list links). */
  onDataNodeUrlChange?: (url: string) => void;
}

function isDarkMode() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("wt-dark");
}

function getTileConfig() {
  if (isDarkMode()) {
    return {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    };
  }
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

function pinMarkerStyle(
  pin: MapPin,
  themeMode: string,
  selected: boolean,
  zoom: number,
  saved: boolean
): import("leaflet").CircleMarkerOptions {
  const dark = themeMode === "dark";
  const baseAudited = {
    color: dark ? "#059669" : "#047857",
    fillColor: dark ? "#6ee7b7" : "#34d399",
    fillOpacity: 0.92,
    weight: selected ? 4 : 2,
  };
  const baseNotAudited = {
    color: dark ? "#3b82f6" : "#1e40af",
    fillColor: dark ? "#60a5fa" : "#60a5fa",
    fillOpacity: 0.9,
    weight: selected ? 4 : 2,
  };
  const style = pin.audited ? baseAudited : baseNotAudited;
  if (saved) {
    return {
      radius: radiusForZoom(zoom, selected) + 1,
      ...style,
      color: "#b45309",
      weight: selected ? 5 : 3.5,
    };
  }
  return {
    radius: radiusForZoom(zoom, selected),
    ...style,
  };
}

function pinStackOrder(pin: MapPin): number {
  return pin.audited ? 2 : 1;
}

function parseBboxClient(raw: string): [number, number, number, number] | null {
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  const [minLat, minLon, maxLat, maxLon] = parts as [number, number, number, number];
  if (minLat >= maxLat || minLon >= maxLon) return null;
  return [minLat, minLon, maxLat, maxLon];
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
  coverageLayerRef: React.MutableRefObject<import("leaflet").LayerGroup | null>,
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
  coverageLayerRef.current = null;
  tileLayerRef.current = null;
  leafletRef.current = null;
  if (containerRef.current) {
    delete (containerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
  }
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
  interactionMode = "select",
  autoFit = true,
  className,
  viewportBrowse = false,
  onDataNodeUrlChange,
}: Props) {
  const { mode } = useTheme();
  const { t } = useLocale();
  const [internalPins, setInternalPins] = useState<MapPin[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [contributor, setContributor] = useState(false);
  const [zoomHint, setZoomHint] = useState(false);
  const [coverageHint, setCoverageHint] = useState(false);

  const nodeUrlRef = useRef(nodeUrl);
  const homeNodeUrlRef = useRef(homeNodeUrl);
  const dataNodeUrlRef = useRef(nodeUrl);
  nodeUrlRef.current = nodeUrl;
  homeNodeUrlRef.current = homeNodeUrl;
  dataNodeUrlRef.current = nodeUrl;

  useEffect(() => {
    const token = readAuthToken();
    setContributor(canContribute(roleFromToken(token)));
  }, []);

  const useExternal = externalPins !== undefined && !viewportBrowse;
  const pins = useExternal ? (externalPins ?? []) : internalPins;
  const loading = useExternal ? (externalLoading ?? false) : internalLoading;
  const error = useExternal ? (externalError ?? "") : internalError;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerGroupRef = useRef<import("leaflet").FeatureGroup | null>(null);
  const userLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const coverageLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const markerByIdRef = useRef<Map<string, import("leaflet").CircleMarker>>(new Map());
  const pinsRef = useRef<MapPin[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const savedIdsRef = useRef<Set<string>>(new Set());
  const lastFitSignatureRef = useRef<string | null>(null);
  const updateRadiiRef = useRef<(() => void) | null>(null);
  const viewportFetchRef = useRef(0);

  pinsRef.current = pins;
  selectedIdRef.current = selectedPropertyId;
  savedIdsRef.current = savedIds ?? new Set();

  const showCoverage = useCallback((regions: CoverageRegion[]) => {
    const L = leafletRef.current;
    const coverage = coverageLayerRef.current;
    if (!L || !coverage) return;
    coverage.clearLayers();
    for (const r of regions) {
      const bb = parseBboxClient(r.bbox);
      if (!bb) continue;
      const [minLat, minLon, maxLat, maxLon] = bb;
      const rect = L.rectangle(
        [
          [minLat, minLon],
          [maxLat, maxLon],
        ],
        {
          color: r.self ? "#0f766e" : "#1d4ed8",
          weight: 1.5,
          fillOpacity: 0.12,
          dashArray: r.self ? undefined : "4 4",
        }
      );
      const label = r.region || r.nodeId || r.url;
      rect.bindTooltip(label, { sticky: true });
      rect.addTo(coverage);
    }
  }, []);

  const refreshViewport = useCallback(async () => {
    if (!viewportBrowse || useExternal) return;
    const map = mapRef.current;
    if (!map) return;

    const zoom = map.getZoom();
    if (zoom < MAP_PIN_MIN_ZOOM) {
      setZoomHint(true);
      setCoverageHint(false);
      setInternalPins([]);
      setInternalError("");
      setInternalLoading(false);
      try {
        const regions = await fetchCoverageRegions(homeNodeUrlRef.current);
        showCoverage(regions);
      } catch {
        showCoverage([]);
      }
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

      if (!peer || peer.matched === "fallback") {
        setCoverageHint(true);
        setInternalPins([]);
        coverageLayerRef.current?.clearLayers();
        try {
          const regions = await fetchCoverageRegions(homeNodeUrlRef.current);
          showCoverage(regions);
        } catch {
          /* ignore */
        }
        return;
      }

      setCoverageHint(false);
      coverageLayerRef.current?.clearLayers();
      const dataUrl = toClientNodeUrl(peer.url);
      dataNodeUrlRef.current = dataUrl;
      onDataNodeUrlChange?.(dataUrl);

      const nextPins = await fetchMapPins(dataUrl, { bbox, signal: AbortSignal.timeout(12_000) });
      if (fetchId !== viewportFetchRef.current) return;
      setInternalPins(nextPins);
    } catch (e) {
      if (fetchId !== viewportFetchRef.current) return;
      if (e instanceof MapPinsError && e.code === "BBOX_TOO_LARGE") {
        setZoomHint(true);
        setInternalPins([]);
        setInternalError("");
      } else {
        setInternalError(t("ui.regionUnreachable"));
        setInternalPins([]);
      }
    } finally {
      if (fetchId === viewportFetchRef.current) setInternalLoading(false);
    }
  }, [viewportBrowse, useExternal, showCoverage, onDataNodeUrlChange, t]);

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
        coverageLayerRef,
        tileLayerRef,
        leafletRef,
        containerRef
      );
      lastFitSignatureRef.current = null;
      setMapReady(false);
      return;
    }
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      leafletRef.current = L;
      const initialCenter: [number, number] = userLocation
        ? [userLocation.lat, userLocation.lon]
        : [52.3, 5.3];
      const initialZoom = userLocation ? 12 : viewportBrowse ? 6 : 7;
      const map = L.map(containerRef.current, { preferCanvas: true }).setView(
        initialCenter,
        initialZoom
      );
      mapRef.current = map;

      const { url, attribution } = getTileConfig();
      tileLayerRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map);

      layerGroupRef.current = L.featureGroup().addTo(map);
      userLayerRef.current = L.layerGroup().addTo(map);
      coverageLayerRef.current = L.layerGroup().addTo(map);

      map.on("zoomend", () => updateRadiiRef.current?.());

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
        coverageLayerRef,
        tileLayerRef,
        leafletRef,
        containerRef
      );
      lastFitSignatureRef.current = null;
      setMapReady(false);
    };
  }, [active, userLocation, viewportBrowse]);

  useEffect(() => {
    if (!mapReady || !viewportBrowse || useExternal) return;
    const map = mapRef.current;
    if (!map) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void refreshViewport();
      }, 280);
    };

    map.on("moveend", schedule);
    map.on("zoomend", schedule);
    schedule();

    return () => {
      if (timer) clearTimeout(timer);
      map.off("moveend", schedule);
      map.off("zoomend", schedule);
    };
  }, [mapReady, viewportBrowse, useExternal, refreshViewport]);

  function ensurePopup(marker: import("leaflet").CircleMarker, pin: MapPin) {
    if (marker.getPopup()) return;
    marker.bindPopup(
      buildAccessMapPopup(
        pin,
        homeNodeUrlRef.current,
        dataNodeUrlRef.current || nodeUrlRef.current,
        {
          view: t("ui.mapViewProperty"),
          audit: t("ui.mapViewAudit"),
          auditedOpen: t("ui.mapAuditedOpen"),
        },
        contributor
      ),
      { maxWidth: 260 }
    );
  }

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

    const sorted = [...pinsRef.current]
      .filter((p) => p.lat !== 0 && p.lon !== 0)
      .sort((a, b) => {
        const order = pinStackOrder(a) - pinStackOrder(b);
        return order !== 0 ? order : a.id.localeCompare(b.id);
      });

    for (const pin of sorted) {
      const selected = pin.id === selectedIdRef.current;
      const saved = savedIdsRef.current.has(pin.id);
      const marker = L.circleMarker(
        [pin.lat, pin.lon],
        pinMarkerStyle(pin, mode, selected, zoom, saved)
      );
      marker.bindTooltip(buildAccessMapTooltip(pin), {
        direction: "top",
        offset: [0, -6],
        opacity: 1,
        className: "wt-map-tooltip-wrap",
        sticky: false,
      });
      marker.on("click", () => {
        ensurePopup(marker, pin);
        marker.openPopup();
        onSelectProperty?.(pin);
      });
      marker.addTo(group);
      markerByIdRef.current.set(pin.id, marker);
      if (pin.audited || saved) marker.bringToFront();
    }

    updateRadiiRef.current = () => {
      const m = mapRef.current;
      if (!m) return;
      const z = m.getZoom();
      markerByIdRef.current.forEach((marker, id) => {
        const bump = savedIdsRef.current.has(id) ? 1 : 0;
        marker.setRadius(radiusForZoom(z, id === selectedIdRef.current) + bump);
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

    const selectedMarker = selectedIdRef.current
      ? markerByIdRef.current.get(selectedIdRef.current)
      : undefined;
    if (selectedMarker) {
      requestAnimationFrame(() => {
        if (!mapRef.current) return;
        try {
          const latLng = selectedMarker.getLatLng();
          const selectedPin = pinsRef.current.find((pin) => pin.id === selectedIdRef.current);
          if (selectedPin) ensurePopup(selectedMarker, selectedPin);
          mapRef.current.setView(latLng, Math.max(mapRef.current.getZoom(), 16), {
            animate: true,
          });
          selectedMarker.openPopup();
        } catch {
          // ignore
        }
      });
      return;
    }

    if (viewportBrowse) return;

    const fitSignature = `${sorted.map((p) => p.id).join(",")}|${userLocation ? `${userLocation.lat},${userLocation.lon}` : ""}|${radiusKm ?? ""}`;
    if (autoFit && fitSignature !== lastFitSignatureRef.current) {
      lastFitSignatureRef.current = fitSignature;
      requestAnimationFrame(() => {
        if (!mapRef.current || !layerGroupRef.current) return;
        safeFitToPins(map, group, pinsRef.current, userLocation);
      });
    }
  }

  useEffect(() => {
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, mode, selectedPropertyId, userLocation, radiusKm, savedIds, onSelectProperty, autoFit, mapReady, contributor, t, viewportBrowse]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const tile = tileLayerRef.current;
    if (!L || !map || !tile) return;

    try {
      map.removeLayer(tile);
    } catch {
      return;
    }

    const { url, attribution } = getTileConfig();
    tileLayerRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map);
  }, [mode]);

  useEffect(() => {
    if (!selectedPropertyId) return;
    const marker = markerByIdRef.current.get(selectedPropertyId);
    const map = mapRef.current;
    if (!marker || !map) return;
    try {
      const latLng = marker.getLatLng();
      const selectedPin = pinsRef.current.find((pin) => pin.id === selectedPropertyId);
      if (selectedPin) ensurePopup(marker, selectedPin);
      map.setView(latLng, Math.max(map.getZoom(), 16), { animate: true });
      marker.openPopup();
    } catch {
      // ignore
    }
  }, [selectedPropertyId, mapReady]);

  const showMapShell = viewportBrowse || pins.length > 0 || useExternal;

  return (
    <div className={className ? `fk-map-tab ${className}` : "fk-map-tab"}>
      {loading && pins.length === 0 && !viewportBrowse && (
        <div className="fk-discovery-skeleton fk-discovery-skeleton--map" aria-hidden="true" />
      )}

      {error && <p className="status-err">{error}</p>}

      {zoomHint && viewportBrowse && (
        <p className="status-muted" role="status">
          {t("ui.mapZoomToSeePlaces")}
        </p>
      )}

      {coverageHint && viewportBrowse && !zoomHint && (
        <p className="status-muted" role="status">
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
          {loading && (
            <div className="fk-map-loading-overlay" aria-hidden="true">
              <span className="fk-map-loading-spinner" />
            </div>
          )}
          <div
            ref={containerRef}
            role="application"
            aria-label={t("ui.mapViewProperty")}
            className="wt-map-container fk-map-container"
          />
          <div className="wt-map-legend" aria-hidden="true">
            <span className="wt-map-legend-item">
              <span className="wt-map-legend-swatch wt-map-legend-swatch--audited" />
              {t("ui.mapAudited")}
            </span>
            <span className="wt-map-legend-item">
              <span className="wt-map-legend-swatch wt-map-legend-swatch--not-audited" />
              {t("ui.mapNotAudited")}
            </span>
            {viewportBrowse && (
              <span className="wt-map-legend-item">{t("ui.mapCoverageLegend")}</span>
            )}
            {savedIds && savedIds.size > 0 && (
              <span className="wt-map-legend-item">
                <span className="wt-map-legend-swatch wt-map-legend-swatch--saved" />
                {t("ui.discoverySaved")}
              </span>
            )}
            {userLocation && (
              <span className="wt-map-legend-item">
                <span className="wt-map-legend-swatch wt-map-legend-swatch--user" />
                {t("ui.discoveryYouAreHere")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
