"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import Link from "next/link";
import { useTheme, useLocale } from "@wikitraveler/ui";
import { buildPopup, type MapPin } from "@/lib/mapPopup";
import { getVisiblePins } from "@/lib/mapVisiblePins";

export type { MapPin };

/** Match Access: below this zoom, skip pin fetches (West-Europe dump is too dense). */
export const MAP_PIN_MIN_ZOOM = 10;

interface Props {
  focusPins?: MapPin[] | null;
  /** Fly/zoom to a single pin without replacing search focus pins. */
  flyToPin?: MapPin | null;
  selectedPinId?: string | null;
  auditedOnly?: boolean;
}

interface MapApiResponse {
  pins?: MapPin[];
  truncated?: boolean;
  message?: string;
  code?: string;
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

function authHeaders(): HeadersInit {
  const m = document.cookie.match(/(?:^|;\s*)wt_token=([^;]+)/);
  const token = m ? decodeURIComponent(m[1]) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatBoundsBbox(b: import("leaflet").LatLngBounds): string {
  return `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
}

function mappablePins(pins: MapPin[]): MapPin[] {
  return pins.filter((p) => p.lat !== 0 && p.lon !== 0);
}

function fitSearchPins(
  L: typeof import("leaflet"),
  map: import("leaflet").Map,
  pins: MapPin[],
  programmaticMoveRef: MutableRefObject<boolean>
) {
  const valid = mappablePins(pins);
  if (valid.length === 0) return;
  programmaticMoveRef.current = true;
  if (valid.length === 1) {
    map.setView([valid[0].lat, valid[0].lon], Math.max(map.getZoom(), 14));
    return;
  }
  const bounds = L.featureGroup(valid.map((p) => L.circleMarker([p.lat, p.lon]))).getBounds();
  map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
}

export function MapView({ focusPins, flyToPin, selectedPinId, auditedOnly }: Props) {
  const { mode } = useTheme();
  const { t } = useLocale();
  const [allPins, setAllPins] = useState<MapPin[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [zoomHint, setZoomHint] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const allPinsRef = useRef<MapPin[]>([]);
  const layerGroupRef = useRef<import("leaflet").FeatureGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const fetchIdRef = useRef(0);
  const lastFocusSignatureRef = useRef<string | null>(null);
  const focusPinsRef = useRef(focusPins);
  focusPinsRef.current = focusPins;
  const programmaticMoveRef = useRef(false);
  const lastZoomRef = useRef<number | null>(null);

  /** Search mode: map + keyboard list show only search hits (not viewport dump). */
  const searchMode = Boolean(focusPins && focusPins.length > 0);

  const displayPins = useMemo(() => {
    if (searchMode && focusPins) return mappablePins(focusPins);
    return allPins;
  }, [allPins, focusPins, searchMode]);

  const visiblePins = useMemo(
    () => getVisiblePins(displayPins, searchMode ? null : focusPins, auditedOnly),
    [displayPins, focusPins, auditedOnly, searchMode]
  );

  const refreshViewport = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    // Search results own the map — skip viewport pin fetches.
    if (focusPinsRef.current && focusPinsRef.current.length > 0) {
      setZoomHint(false);
      setTruncated(false);
      setMapError("");
      return;
    }

    const zoom = map.getZoom();
    if (zoom < MAP_PIN_MIN_ZOOM) {
      setZoomHint(true);
      setTruncated(false);
      setMapError("");
      allPinsRef.current = [];
      setAllPins([]);
      return;
    }

    setZoomHint(false);
    const bbox = formatBoundsBbox(map.getBounds());
    const fetchId = ++fetchIdRef.current;

    try {
      const res = await fetch(`/api/properties/map?bbox=${encodeURIComponent(bbox)}`, {
        headers: authHeaders(),
      });
      if (fetchId !== fetchIdRef.current) return;

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as MapApiResponse;
        if (err.code === "BBOX_TOO_LARGE") {
          setZoomHint(true);
          setTruncated(false);
          setMapError("");
          allPinsRef.current = [];
          setAllPins([]);
          return;
        }
        setMapError(err.message ?? err.code ?? "map failed");
        return;
      }

      const data = (await res.json()) as MapApiResponse;
      if (fetchId !== fetchIdRef.current) return;

      const pins = mappablePins(data.pins ?? []);
      allPinsRef.current = pins;
      setAllPins(pins);
      setTruncated(Boolean(data.truncated));
      setMapError("");
    } catch (e) {
      if (fetchId !== fetchIdRef.current) return;
      setMapError(e instanceof Error ? e.message : "map failed");
    }
  }, []);

  // Init Leaflet once — no region=1 dump (West-Europe exceeds pin cap).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      leafletRef.current = L;
      const map = L.map(containerRef.current, { preferCanvas: false }).setView([52.3, 5.3], 7);
      mapRef.current = map;

      const { url, attribution } = getTileConfig();
      tileLayerRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map);

      const group = L.featureGroup();
      layerGroupRef.current = group;
      group.addTo(map);

      setMapReady(true);
    });

    return () => {
      cancelled = true;
      setMapReady(false);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerGroupRef.current = null;
        tileLayerRef.current = null;
        leafletRef.current = null;
        allPinsRef.current = [];
        if (containerRef.current) {
          delete (containerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
        }
      }
    };
  }, []);

  // Viewport fetch on pan/zoom (debounced).
  useEffect(() => {
    if (!mapReady) return;
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
  }, [mapReady, refreshViewport]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !tileLayerRef.current) return;

    map.removeLayer(tileLayerRef.current);
    const { url, attribution } = getTileConfig();
    tileLayerRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map);
  }, [mode]);

  // Re-render markers when pins / focus / theme change (do not refit on viewport refresh).
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!L || !map || !group) return;

    const pinsForLayer = searchMode && focusPins ? mappablePins(focusPins) : allPinsRef.current;
    group.clearLayers();

    const auditDimIds = auditedOnly
      ? new Set(pinsForLayer.filter((p) => !p.audited).map((p) => p.id))
      : null;

    const highlightIds = selectedPinId ? new Set([selectedPinId]) : undefined;
    renderPins(L, group, pinsForLayer, false, highlightIds, auditDimIds ?? undefined, mode);
  }, [allPins, focusPins, auditedOnly, mode, searchMode, selectedPinId]);

  // Fly to search results once; keep map in search-only pin mode until search clears.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (!focusPins || focusPins.length === 0) {
      lastFocusSignatureRef.current = null;
      // Leaving search → restore viewport pins for current bounds.
      void refreshViewport();
      return;
    }

    // Drop cached viewport pins so browse mode cannot bleed through.
    allPinsRef.current = [];
    setAllPins([]);
    setZoomHint(false);
    setTruncated(false);

    const signature = focusPins.map((p) => p.id).sort().join(",");
    if (signature === lastFocusSignatureRef.current) return;
    lastFocusSignatureRef.current = signature;

    const validFocus = mappablePins(focusPins);
    fitSearchPins(L, map, validFocus, programmaticMoveRef);
  }, [focusPins, refreshViewport]);

  // Refit to all search pins when the user zooms out after selecting one.
  useEffect(() => {
    if (!mapReady || !searchMode) return;
    const map = mapRef.current;
    if (!map) return;

    const onZoomEnd = () => {
      if (programmaticMoveRef.current) {
        programmaticMoveRef.current = false;
        lastZoomRef.current = map.getZoom();
        return;
      }

      const zoom = map.getZoom();
      const prev = lastZoomRef.current;
      lastZoomRef.current = zoom;

      if (prev !== null && zoom < prev - 0.1) {
        const L = leafletRef.current;
        const pins = focusPinsRef.current;
        if (L && pins && pins.length > 0) {
          fitSearchPins(L, map, pins, programmaticMoveRef);
        }
      }
    };

    lastZoomRef.current = map.getZoom();
    map.on("zoomend", onZoomEnd);
    return () => {
      map.off("zoomend", onZoomEnd);
    };
  }, [mapReady, searchMode]);

  // Zoom to a list selection without changing the search result pin set.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToPin) return;
    if (flyToPin.lat === 0 && flyToPin.lon === 0) return;
    programmaticMoveRef.current = true;
    map.flyTo([flyToPin.lat, flyToPin.lon], Math.max(map.getZoom(), 15), { duration: 0.45 });
  }, [flyToPin]);

  return (
    <div>
      <div className="wt-map-frame" style={{ position: "relative" }}>
        <div
          ref={containerRef}
          role="application"
          aria-label="Interactive map of properties with accessibility data. Use the property list below for keyboard access."
          className="wt-map-container"
        />
        {zoomHint && !searchMode && (
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 12,
              zIndex: 500,
              padding: "10px 14px",
              borderRadius: 10,
              background: "var(--wt-bg-elevated)",
              border: "1px solid var(--wt-border)",
              color: "var(--wt-text)",
              fontSize: 14,
              fontWeight: 600,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              pointerEvents: "none",
            }}
          >
            {t("ui.mapZoomToSeePlaces")}
          </div>
        )}
        {truncated && !zoomHint && !searchMode && (
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 12,
              zIndex: 500,
              padding: "8px 12px",
              borderRadius: 10,
              background: "var(--wt-bg-elevated)",
              border: "1px solid var(--wt-border)",
              color: "var(--wt-text-muted)",
              fontSize: 13,
              pointerEvents: "none",
            }}
          >
            Showing a subset of places in this view — zoom in for denser areas
          </div>
        )}
        {mapError && !zoomHint && (
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              top: 12,
              zIndex: 500,
              padding: "8px 12px",
              borderRadius: 10,
              background: "var(--wt-bg-elevated)",
              border: "1px solid var(--wt-border)",
              color: "var(--wt-text)",
              fontSize: 13,
            }}
          >
            {mapError}
          </div>
        )}
        {displayPins.length > 0 && (
          <div className="wt-map-legend" aria-hidden="true">
            <span className="wt-map-legend-item">
              <span className="wt-map-legend-swatch wt-map-legend-swatch--audited" />
              {t("ui.mapAudited")}
            </span>
            <span className="wt-map-legend-item">
              <span className="wt-map-legend-swatch wt-map-legend-swatch--not-audited" />
              {t("ui.mapNotAudited")}
            </span>
          </div>
        )}
      </div>
      {visiblePins.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            aria-controls="map-property-list"
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--wt-border)",
              background: "var(--wt-bg-elevated)",
              color: "var(--wt-text)",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {listOpen ? "Hide" : "Show"} keyboard-accessible property list ({visiblePins.length})
          </button>
          {listOpen && (
            <ul
              id="map-property-list"
              style={{
                listStyle: "none",
                marginTop: 8,
                maxHeight: 220,
                overflowY: "auto",
                border: "1px solid var(--wt-border)",
                borderRadius: 10,
                background: "var(--wt-bg-elevated)",
              }}
            >
              {visiblePins.map((pin) => (
                <li key={pin.id} style={{ borderBottom: "1px solid var(--wt-border)" }}>
                  <Link
                    href={`/properties/${pin.id}`}
                    style={{
                      display: "block",
                      padding: "10px 14px",
                      color: "var(--wt-text)",
                      textDecoration: "none",
                      fontSize: 14,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{pin.name}</span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--wt-text-muted)", marginTop: 2 }}>
                      {pin.location}
                      {pin.audited ? ` · ${t("ui.mapAudited")}` : ` · ${t("ui.mapNotAudited")}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function pinMarkerStyle(
  pin: MapPin,
  dim: boolean,
  themeMode: string,
  selected = false
): import("leaflet").CircleMarkerOptions {
  if (selected && !dim) {
    const dark = themeMode === "dark";
    if (pin.audited) {
      return {
        radius: 11,
        color: dark ? "#34d399" : "#047857",
        fillColor: dark ? "#6ee7b7" : "#34d399",
        fillOpacity: 1,
        weight: 3,
      };
    }
    return {
      radius: 11,
      color: dark ? "#93c5fd" : "#1d4ed8",
      fillColor: dark ? "#93c5fd" : "#3b82f6",
      fillOpacity: 1,
      weight: 3,
    };
  }

  if (dim) {
    return {
      radius: 4,
      color: "#94a3b8",
      fillColor: "#cbd5e1",
      fillOpacity: 0.5,
      weight: 1,
    };
  }

  const dark = themeMode === "dark";
  if (pin.audited) {
    return {
      radius: 8,
      color: dark ? "#059669" : "#047857",
      fillColor: dark ? "#6ee7b7" : "#34d399",
      fillOpacity: 0.92,
      weight: 2,
    };
  }

  return {
    radius: 8,
    color: dark ? "#3b82f6" : "#1e40af",
    fillColor: dark ? "#60a5fa" : "#60a5fa",
    fillOpacity: 0.9,
    weight: 2,
  };
}

function pinStackOrder(pin: MapPin, dim: boolean): number {
  if (dim) return 0;
  return pin.audited ? 2 : 1;
}

function renderPins(
  L: typeof import("leaflet"),
  group: import("leaflet").FeatureGroup,
  pins: MapPin[],
  dimAll: boolean,
  highlightIds?: Set<string>,
  dimIds?: Set<string>,
  themeMode = "light"
) {
  const isDim = (p: MapPin) =>
    dimIds ? dimIds.has(p.id) : dimAll ? !(highlightIds?.has(p.id) ?? false) : false;

  const sorted = [...pins].sort((a, b) => {
    const order = pinStackOrder(a, isDim(a)) - pinStackOrder(b, isDim(b));
    return order !== 0 ? order : a.id.localeCompare(b.id);
  });

  for (const pin of sorted) {
    const dim = isDim(pin);
    const selected = highlightIds?.has(pin.id) ?? false;
    const marker = L.circleMarker([pin.lat, pin.lon], pinMarkerStyle(pin, dim, themeMode, selected)).bindPopup(
      buildPopup(pin),
      { maxWidth: 260 }
    );
    marker.addTo(group);
    if (selected || (!dim && pin.audited)) {
      marker.bringToFront();
    }
  }
}
