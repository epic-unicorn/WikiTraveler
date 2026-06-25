"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme, useLocale } from "@wikitraveler/ui";
import { fetchMapPins, type MapPin } from "../lib/accessApi";
import { buildAccessMapPopup, buildAccessMapTooltip } from "../lib/mapPopup";
import { readAuthToken } from "../lib/authStorage";
import { canContribute, roleFromToken } from "../lib/userRole";

interface UserLocation {
  lat: number;
  lon: number;
}

interface Props {
  nodeUrl: string;
  homeNodeUrl: string;
  active: boolean;
  /** External pins — when set, internal fetch is skipped. */
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

/**
 * Scale the dot radius with the zoom level so that, when zoomed out, dots are
 * small enough to keep every property visible (less overlap), while staying
 * large enough to remain tappable. Selected dots get a small bump.
 */
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
    // Saved properties get an amber ring to stand out on the map.
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
}: Props) {
  const { mode } = useTheme();
  const { t } = useLocale();
  const [internalPins, setInternalPins] = useState<MapPin[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [contributor, setContributor] = useState(false);

  const nodeUrlRef = useRef(nodeUrl);
  const homeNodeUrlRef = useRef(homeNodeUrl);
  nodeUrlRef.current = nodeUrl;
  homeNodeUrlRef.current = homeNodeUrl;

  useEffect(() => {
    const token = readAuthToken();
    setContributor(canContribute(roleFromToken(token)));
  }, []);

  const useExternal = externalPins !== undefined;
  const pins = useExternal ? externalPins : internalPins;
  const loading = useExternal ? (externalLoading ?? false) : internalLoading;
  const error = useExternal ? (externalError ?? "") : internalError;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerGroupRef = useRef<import("leaflet").FeatureGroup | null>(null);
  const userLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const markerByIdRef = useRef<Map<string, import("leaflet").CircleMarker>>(new Map());
  const pinsRef = useRef<MapPin[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const savedIdsRef = useRef<Set<string>>(new Set());
  const lastFitSignatureRef = useRef<string | null>(null);
  const updateRadiiRef = useRef<(() => void) | null>(null);

  pinsRef.current = pins;
  selectedIdRef.current = selectedPropertyId;
  savedIdsRef.current = savedIds ?? new Set();

  useEffect(() => {
    if (useExternal || !active) return;
    let cancelled = false;
    const controller = new AbortController();
    setInternalLoading(true);
    setInternalError("");

    fetchMapPins(nodeUrl, controller.signal)
      .then((data) => {
        if (cancelled) return;
        setInternalPins(data);
      })
      .catch(() => {
        if (!cancelled) {
          setInternalError(t("ui.searchNodeUnreachable"));
          setInternalPins([]);
        }
      })
      .finally(() => {
        if (!cancelled) setInternalLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, nodeUrl, t, useExternal]);

  useEffect(() => {
    if (!active) {
      destroyMap(mapRef, layerGroupRef, userLayerRef, tileLayerRef, leafletRef, containerRef);
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
      const initialZoom = userLocation ? 14 : 7;
      const map = L.map(containerRef.current, { preferCanvas: true }).setView(
        initialCenter,
        initialZoom
      );
      mapRef.current = map;

      const { url, attribution } = getTileConfig();
      tileLayerRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map);

      layerGroupRef.current = L.featureGroup().addTo(map);
      userLayerRef.current = L.layerGroup().addTo(map);

      map.on("zoomend", () => updateRadiiRef.current?.());

      requestAnimationFrame(() => {
        if (!mapRef.current) return;
        map.invalidateSize();
      });

      setMapReady(true);
    });

    return () => {
      cancelled = true;
      destroyMap(mapRef, layerGroupRef, userLayerRef, tileLayerRef, leafletRef, containerRef);
      lastFitSignatureRef.current = null;
      setMapReady(false);
    };
  }, [active, userLocation]);

  function ensurePopup(marker: import("leaflet").CircleMarker, pin: MapPin) {
    if (marker.getPopup()) return;
    marker.bindPopup(
      buildAccessMapPopup(
        pin,
        homeNodeUrlRef.current,
        nodeUrlRef.current,
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

    // If a property is selected (e.g. opened from the list "show on map"
    // button), zoom to it and open its popup instead of fitting all pins.
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
          // Map container may be hidden or mid-teardown.
        }
      });
      return;
    }

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
  }, [pins, mode, selectedPropertyId, userLocation, radiusKm, savedIds, onSelectProperty, autoFit, mapReady, contributor, t]);

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

  return (
    <div className={className ? `fk-map-tab ${className}` : "fk-map-tab"}>
      {loading && pins.length === 0 && (
        <div className="fk-discovery-skeleton fk-discovery-skeleton--map" aria-hidden="true" />
      )}

      {error && <p className="status-err">{error}</p>}

      {!loading && !error && pins.length === 0 && (
        <div className="fk-empty" style={{ paddingTop: 32 }}>
          <span className="fk-empty-icon">🗺️</span>
          <p className="fk-empty-title">{t("ui.regionEmptyMap")}</p>
        </div>
      )}

      {/* Keep the map container mounted whenever pins exist — even while a new
          search is loading — so the Leaflet instance is never torn away from its
          DOM node (which would leave a blank map on the next render). */}
      {pins.length > 0 && (
        <>
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
        </>
      )}
    </div>
  );
}
