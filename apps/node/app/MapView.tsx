"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTheme, useLocale } from "@wikitraveler/ui";
import { buildPopup, type MapPin } from "@/lib/mapPopup";
import { getVisiblePins } from "@/lib/mapVisiblePins";

export type { MapPin };

interface Props {
  focusPins?: MapPin[] | null;
  auditedOnly?: boolean;
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

export function MapView({ focusPins, auditedOnly }: Props) {
  const { mode } = useTheme();
  const { t } = useLocale();
  const [allPins, setAllPins] = useState<MapPin[]>([]);
  const [listOpen, setListOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const allPinsRef = useRef<MapPin[]>([]);
  const layerGroupRef = useRef<unknown>(null);
  const leafletRef = useRef<unknown>(null);
  const tileLayerRef = useRef<unknown>(null);

  const visiblePins = useMemo(
    () => getVisiblePins(allPins, focusPins, auditedOnly),
    [allPins, focusPins, auditedOnly]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    const token = (() => {
      const m = document.cookie.match(/(?:^|;\s*)wt_token=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    })();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    Promise.all([
      import("leaflet"),
      fetch("/api/properties/map?region=1", { headers }).then(async (r) => {
        if (!r.ok) {
          const err = (await r.json().catch(() => ({}))) as { message?: string; code?: string };
          return { pins: [] as MapPin[], error: err.message ?? err.code ?? "map failed" };
        }
        return r.json() as Promise<{ pins: MapPin[] }>;
      }),
    ]).then(([L, data]) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const pins = (data.pins ?? []).filter((p) => p.lat !== 0 && p.lon !== 0);
      allPinsRef.current = pins;
      setAllPins(pins);
      leafletRef.current = L;

      if (pins.length === 0) return;

      const map = (L as typeof import("leaflet")).map(containerRef.current, { preferCanvas: false }).setView([52.3, 5.3], 7);
      mapRef.current = map;

      const { url, attribution } = getTileConfig();
      tileLayerRef.current = (L as typeof import("leaflet"))
        .tileLayer(url, { attribution, maxZoom: 19 })
        .addTo(map);

      const group = (L as typeof import("leaflet")).featureGroup();
      layerGroupRef.current = group;
      renderPins(L as typeof import("leaflet"), group, pins, false, undefined, undefined, mode);
      group.addTo(map);

      if (pins.length > 1) map.fitBounds(group.getBounds(), { padding: [32, 32] });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
        layerGroupRef.current = null;
        tileLayerRef.current = null;
        allPinsRef.current = [];
        if (containerRef.current) {
          delete (containerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
        }
      }
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current as typeof import("leaflet") | null;
    const map = mapRef.current as import("leaflet").Map | null;
    if (!L || !map || !tileLayerRef.current) return;

    map.removeLayer(tileLayerRef.current as import("leaflet").TileLayer);
    const { url, attribution } = getTileConfig();
    tileLayerRef.current = (L as typeof import("leaflet"))
      .tileLayer(url, { attribution, maxZoom: 19 })
      .addTo(map);
  }, [mode]);

  useEffect(() => {
    const L = leafletRef.current as typeof import("leaflet") | null;
    const map = mapRef.current as import("leaflet").Map | null;
    const group = layerGroupRef.current as import("leaflet").FeatureGroup | null;
    if (!L || !map || !group) return;

    group.clearLayers();

    const auditDimIds = auditedOnly
      ? new Set(allPinsRef.current.filter((p) => !p.audited).map((p) => p.id))
      : null;

    if (!focusPins || focusPins.length === 0) {
      renderPins(L, group, allPinsRef.current, false, undefined, auditDimIds ?? undefined, mode);
      if (allPinsRef.current.length > 1) map.fitBounds(group.getBounds(), { padding: [32, 32] });
    } else {
      const focusIds = new Set(focusPins.map((p) => p.id));
      const dimIds = new Set(
        allPinsRef.current
          .filter((p) => !focusIds.has(p.id) || (auditDimIds?.has(p.id) ?? false))
          .map((p) => p.id)
      );
      renderPins(L, group, allPinsRef.current, true, focusIds, dimIds, mode);
      const validFocus = focusPins.filter((p) => p.lat !== 0 && p.lon !== 0);
      if (validFocus.length === 1) {
        map.setView([validFocus[0].lat, validFocus[0].lon], 14);
      } else if (validFocus.length > 1) {
        const bounds = L.featureGroup(validFocus.map((p) => L.circleMarker([p.lat, p.lon]))).getBounds();
        map.fitBounds(bounds, { padding: [48, 48] });
      }
    }
  }, [focusPins, auditedOnly, mode]);

  return (
    <div>
      <div className="wt-map-frame">
        <div
          ref={containerRef}
          role="application"
          aria-label="Interactive map of properties with accessibility data. Use the property list below for keyboard access."
          className="wt-map-container"
        />
        {allPins.length > 0 && (
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

function pinMarkerStyle(pin: MapPin, dim: boolean, themeMode: string): import("leaflet").CircleMarkerOptions {
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
    const marker = L.circleMarker([pin.lat, pin.lon], pinMarkerStyle(pin, dim, themeMode))
      .bindPopup(buildPopup(pin), { maxWidth: 260 });
    marker.addTo(group);
    if (!dim && pin.audited) {
      marker.bringToFront();
    }
  }
}
