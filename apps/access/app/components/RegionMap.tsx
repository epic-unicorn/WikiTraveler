"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme, useLocale } from "@wikitraveler/ui";
import { fetchMapPins, type MapPin } from "../lib/accessApi";
import { buildAccessMapPopup } from "../lib/mapPopup";
import { propertyOrAuditHref } from "../lib/propertyHref";
import { readAuthToken } from "../lib/authStorage";
import { canContribute, roleFromToken } from "../lib/userRole";

interface Props {
  nodeUrl: string;
  homeNodeUrl: string;
  active: boolean;
  regionLabel?: string | null;
  showPropertyList?: boolean;
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

function pinMarkerStyle(pin: MapPin, themeMode: string): import("leaflet").CircleMarkerOptions {
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

function pinStackOrder(pin: MapPin): number {
  return pin.audited ? 2 : 1;
}

function renderPins(
  L: typeof import("leaflet"),
  group: import("leaflet").FeatureGroup,
  pins: MapPin[],
  homeNodeUrl: string,
  propertyNodeUrl: string,
  themeMode: string,
  ctaLabel: string,
  auditedOpenLabel: string,
  asContributor: boolean
): import("leaflet").CircleMarker[] {
  const auditedMarkers: import("leaflet").CircleMarker[] = [];
  const sorted = [...pins].sort((a, b) => {
    const order = pinStackOrder(a) - pinStackOrder(b);
    return order !== 0 ? order : a.id.localeCompare(b.id);
  });

  for (const pin of sorted) {
    const marker = L.circleMarker([pin.lat, pin.lon], pinMarkerStyle(pin, themeMode)).bindPopup(
      buildAccessMapPopup(pin, homeNodeUrl, propertyNodeUrl, ctaLabel, auditedOpenLabel, asContributor),
      { maxWidth: 260 }
    );
    marker.addTo(group);
    if (pin.audited) auditedMarkers.push(marker);
  }

  return auditedMarkers;
}

function safeFitToPins(
  map: import("leaflet").Map,
  group: import("leaflet").FeatureGroup,
  pins: MapPin[]
) {
  if (pins.length === 0) return;
  try {
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lon], 13);
      return;
    }
    const bounds = group.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [32, 32] });
    }
  } catch {
    // Map container may be hidden or mid-teardown.
  }
}

function destroyMap(
  mapRef: React.MutableRefObject<import("leaflet").Map | null>,
  layerGroupRef: React.MutableRefObject<import("leaflet").FeatureGroup | null>,
  tileLayerRef: React.MutableRefObject<import("leaflet").TileLayer | null>,
  leafletRef: React.MutableRefObject<typeof import("leaflet") | null>,
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  if (mapRef.current) {
    mapRef.current.remove();
    mapRef.current = null;
  }
  layerGroupRef.current = null;
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
  regionLabel,
  showPropertyList = true,
}: Props) {
  const { mode } = useTheme();
  const { t } = useLocale();
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [contributor, setContributor] = useState(false);

  useEffect(() => {
    const token = readAuthToken();
    setContributor(canContribute(roleFromToken(token)));
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerGroupRef = useRef<import("leaflet").FeatureGroup | null>(null);
  const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const pinsRef = useRef<MapPin[]>([]);
  const nodeUrlRef = useRef(nodeUrl);
  const homeNodeUrlRef = useRef(homeNodeUrl);

  nodeUrlRef.current = nodeUrl;
  homeNodeUrlRef.current = homeNodeUrl;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError("");

    fetchMapPins(nodeUrl, controller.signal)
      .then((data) => {
        if (cancelled) return;
        pinsRef.current = data;
        setPins(data);
      })
      .catch(() => {
        if (!cancelled) {
          setError(t("ui.searchNodeUnreachable"));
          setPins([]);
          pinsRef.current = [];
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, nodeUrl, t]);

  useEffect(() => {
    if (!active) {
      destroyMap(mapRef, layerGroupRef, tileLayerRef, leafletRef, containerRef);
      return;
    }
    if (!containerRef.current || mapRef.current || pins.length === 0) return;

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
      const auditedMarkers = renderPins(
        L,
        group,
        pinsRef.current,
        homeNodeUrlRef.current,
        nodeUrlRef.current,
        mode,
        contributor ? t("ui.mapViewOrAudit") : t("ui.mapViewProperty"),
        t("ui.mapAuditedOpen"),
        contributor
      );
      group.addTo(map);
      for (const marker of auditedMarkers) marker.bringToFront();

      requestAnimationFrame(() => {
        if (!mapRef.current) return;
        map.invalidateSize();
        safeFitToPins(map, group, pinsRef.current);
      });
    });

    return () => {
      cancelled = true;
      destroyMap(mapRef, layerGroupRef, tileLayerRef, leafletRef, containerRef);
    };
  }, [active, pins.length]);

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
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!L || !map || !group || pinsRef.current.length === 0) return;

    group.clearLayers();
    const auditedMarkers = renderPins(
      L,
      group,
      pinsRef.current,
      homeNodeUrlRef.current,
      nodeUrlRef.current,
      mode,
      contributor ? t("ui.mapViewOrAudit") : t("ui.mapViewProperty"),
      t("ui.mapAuditedOpen"),
      contributor
    );
    for (const marker of auditedMarkers) marker.bringToFront();

    safeFitToPins(map, group, pinsRef.current);
  }, [pins, mode, t, contributor]);

  const auditedCount = pins.filter((p) => p.audited).length;

  return (
    <div className="fk-map-tab">
      {regionLabel && (
        <p className="fk-map-region-label">
          <span className="fk-chip fk-chip--info">📍 {regionLabel}</span>
        </p>
      )}

      {loading && (
        <p className="status-muted" style={{ textAlign: "center", padding: "16px 0" }}>
          {t("ui.loadingMap")}
        </p>
      )}

      {error && <p className="status-err">{error}</p>}

      {!loading && !error && pins.length === 0 && (
        <div className="fk-empty" style={{ paddingTop: 32 }}>
          <span className="fk-empty-icon">🗺️</span>
          <p className="fk-empty-title">{t("ui.regionEmptyMap")}</p>
        </div>
      )}

      {pins.length > 0 && (
        <>
          <p className="status-muted" style={{ fontSize: 12, marginBottom: 8 }}>
            {pins.length} {t("ui.mapProperties")} · {auditedCount} {t("ui.mapAudited").toLowerCase()}
          </p>
          <div className="wt-map-frame fk-map-frame">
            <div
              ref={containerRef}
              role="application"
              aria-label={contributor ? t("ui.mapViewOrAudit") : t("ui.mapViewProperty")}
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
            </div>
          </div>

          {showPropertyList && (
            <>
              <button
                type="button"
                onClick={() => setListOpen((v) => !v)}
                aria-expanded={listOpen}
                aria-controls="fk-map-property-list"
                className="fk-map-list-toggle"
              >
                {listOpen ? t("ui.mapHideList") : t("ui.mapShowList")} ({pins.length})
              </button>
              {listOpen && (
                <ul id="fk-map-property-list" className="fk-map-property-list">
                  {pins.map((pin) => (
                    <li key={pin.id}>
                      <Link
                        href={propertyOrAuditHref(pin.id, nodeUrl, homeNodeUrl, contributor)}
                        className="fk-map-property-link"
                      >
                        <span className="fk-map-property-name">{pin.name}</span>
                        <span className="fk-map-property-meta">
                          {pin.location} · {pin.audited ? t("ui.mapAudited") : t("ui.mapNotAudited")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
