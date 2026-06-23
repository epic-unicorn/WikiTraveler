"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme, useLocale } from "@wikitraveler/ui";
import { fetchMapPins, type MapPin } from "../lib/fieldKitApi";
import { buildFieldKitMapPopup } from "../lib/mapPopup";
import { auditHref } from "../lib/auditHref";

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
  auditLabel: string,
  auditedOpenLabel: string
) {
  const sorted = [...pins].sort((a, b) => {
    const order = pinStackOrder(a) - pinStackOrder(b);
    return order !== 0 ? order : a.id.localeCompare(b.id);
  });

  for (const pin of sorted) {
    const marker = L.circleMarker([pin.lat, pin.lon], pinMarkerStyle(pin, themeMode)).bindPopup(
      buildFieldKitMapPopup(pin, homeNodeUrl, propertyNodeUrl, auditLabel, auditedOpenLabel),
      { maxWidth: 260 }
    );
    marker.addTo(group);
    if (pin.audited) marker.bringToFront();
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

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerGroupRef = useRef<import("leaflet").FeatureGroup | null>(null);
  const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const pinsRef = useRef<MapPin[]>([]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    setError("");

    fetchMapPins(nodeUrl)
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
    };
  }, [active, nodeUrl, t]);

  useEffect(() => {
    if (active) return;
    if (!mapRef.current) return;
    mapRef.current.remove();
    mapRef.current = null;
    layerGroupRef.current = null;
    tileLayerRef.current = null;
    leafletRef.current = null;
    if (containerRef.current) {
      delete (containerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
    }
  }, [active]);

  useEffect(() => {
    if (!active || !containerRef.current || mapRef.current || pins.length === 0) return;

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
      renderPins(
        L,
        group,
        pinsRef.current,
        homeNodeUrl,
        nodeUrl,
        mode,
        t("ui.mapViewOrAudit"),
        t("ui.mapAuditedOpen")
      );
      group.addTo(map);

      if (pinsRef.current.length > 1) {
        map.fitBounds(group.getBounds(), { padding: [32, 32] });
      } else if (pinsRef.current.length === 1) {
        map.setView([pinsRef.current[0].lat, pinsRef.current[0].lon], 13);
      }
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerGroupRef.current = null;
        tileLayerRef.current = null;
        leafletRef.current = null;
        if (containerRef.current) {
          delete (containerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
        }
      }
    };
  }, [active, pins.length, homeNodeUrl, nodeUrl, mode, t]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !tileLayerRef.current) return;

    map.removeLayer(tileLayerRef.current);
    const { url, attribution } = getTileConfig();
    tileLayerRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map);
  }, [mode]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!L || !map || !group || pinsRef.current.length === 0) return;

    group.clearLayers();
    renderPins(
      L,
      group,
      pinsRef.current,
      homeNodeUrl,
      nodeUrl,
      mode,
      t("ui.mapViewOrAudit"),
      t("ui.mapAuditedOpen")
    );
    if (pinsRef.current.length > 1) {
      map.fitBounds(group.getBounds(), { padding: [32, 32] });
    }
  }, [pins, homeNodeUrl, nodeUrl, mode, t]);

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
              aria-label={t("ui.mapViewOrAudit")}
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
                      <Link href={auditHref(pin.id, nodeUrl, homeNodeUrl)} className="fk-map-property-link">
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
