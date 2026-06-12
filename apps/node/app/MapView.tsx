"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@wikitraveler/ui";

export interface MapPin {
  id: string;
  name: string;
  location: string;
  lat: number;
  lon: number;
  audited?: boolean;
  facts?: Record<string, { value: string; tier: string }>;
}

interface Props {
  /** When provided, zoom to and highlight only these pins. Pass null to reset to all. */
  focusPins?: MapPin[] | null;
  /** When true, dim pins that have not been field-audited. */
  auditedOnly?: boolean;
}

const FACT_LABELS: Record<string, string> = {
  step_free_entrance: "Step-free entrance",
  accessible_bathroom: "Accessible bathroom",
  elevator_present: "Elevator",
  ramp_present: "Ramp",
  parking_accessible: "Accessible parking",
};

// ── Tile layer helpers ────────────────────────────────────────────────────────

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

// ── Popup builder (uses CSS classes, not inline colors) ────────────────────────

function buildPopup(pin: MapPin): string {
  const facts = pin.facts ?? {};
  const factRows = Object.keys(FACT_LABELS)
    .map((key) => {
      const fact = facts[key];
      if (!fact) return "";
      const icon = fact.value === "yes" ? "✅" : fact.value === "no" ? "❌" : "❓";
      return `<div class="wt-popup-fact">${icon} ${FACT_LABELS[key]}</div>`;
    })
    .filter(Boolean)
    .join("");

  return `
    <div class="wt-popup">
      <p class="wt-popup-title">${pin.name}</p>
      <p class="wt-popup-loc">📍 ${pin.location}</p>
      ${factRows ? `<div class="wt-popup-facts">${factRows}</div>` : ""}
      <a href="/properties/${pin.id}" class="wt-popup-cta">View / Audit →</a>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────

export function MapView({ focusPins, auditedOnly }: Props) {
  const { mode } = useTheme();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const allPinsRef = useRef<MapPin[]>([]);
  const layerGroupRef = useRef<unknown>(null);
  const leafletRef = useRef<unknown>(null);
  const tileLayerRef = useRef<unknown>(null);

  // ── Initial mount: load pins, create map, add first tile layer ──────────────
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
      fetch("/api/properties/map", { headers }).then((r) => r.json() as Promise<{ pins: MapPin[] }>),
    ]).then(([L, data]) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const pins = (data.pins ?? []).filter((p) => p.lat !== 0 && p.lon !== 0);
      allPinsRef.current = pins;
      leafletRef.current = L;

      if (pins.length === 0) return;

      const map = (L as typeof import("leaflet")).map(containerRef.current, { preferCanvas: false }).setView([52.3, 5.3], 7);
      mapRef.current = map;

      // Add the correct tile layer for the current theme
      const { url, attribution } = getTileConfig();
      tileLayerRef.current = (L as typeof import("leaflet"))
        .tileLayer(url, { attribution, maxZoom: 19 })
        .addTo(map);

      const group = (L as typeof import("leaflet")).featureGroup();
      layerGroupRef.current = group;
      renderPins(L as typeof import("leaflet"), group, pins, false);
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

  // ── Swap tile layer whenever the theme changes ──────────────────────────────
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

  // ── React to focusPins / auditedOnly changes ───────────────────────────────
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
      renderPins(L, group, allPinsRef.current, false, undefined, auditDimIds ?? undefined);
      if (allPinsRef.current.length > 1) map.fitBounds(group.getBounds(), { padding: [32, 32] });
    } else {
      const focusIds = new Set(focusPins.map((p) => p.id));
      const dimIds = new Set(
        allPinsRef.current
          .filter((p) => !focusIds.has(p.id) || (auditDimIds?.has(p.id) ?? false))
          .map((p) => p.id)
      );
      renderPins(L, group, allPinsRef.current, true, focusIds, dimIds);
      const validFocus = focusPins.filter((p) => p.lat !== 0 && p.lon !== 0);
      if (validFocus.length === 1) {
        map.setView([validFocus[0].lat, validFocus[0].lon], 14);
      } else if (validFocus.length > 1) {
        const bounds = L.featureGroup(validFocus.map((p) => L.circleMarker([p.lat, p.lon]))).getBounds();
        map.fitBounds(bounds, { padding: [48, 48] });
      }
    }
  }, [focusPins, auditedOnly]);

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 420,
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid var(--wt-border)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function renderPins(
  L: typeof import("leaflet"),
  group: import("leaflet").FeatureGroup,
  pins: MapPin[],
  dimAll: boolean,
  highlightIds?: Set<string>,
  dimIds?: Set<string>
) {
  const isDim = (p: MapPin) =>
    dimIds ? dimIds.has(p.id) : dimAll ? !(highlightIds?.has(p.id) ?? false) : false;

  const dimPins = pins.filter(isDim);
  const brightPins = pins.filter((p) => !isDim(p));

  for (const pin of dimPins) {
    L.circleMarker([pin.lat, pin.lon], {
      radius: 4,
      color: "#94a3b8",
      fillColor: "#cbd5e1",
      fillOpacity: 0.5,
      weight: 1,
    })
      .bindPopup(buildPopup(pin), { maxWidth: 260 })
      .addTo(group);
  }

  for (const pin of brightPins) {
    L.circleMarker([pin.lat, pin.lon], {
      radius: 8,
      color: "#1e40af",
      fillColor: "#60a5fa",
      fillOpacity: 0.9,
      weight: 2,
    })
      .bindPopup(buildPopup(pin), { maxWidth: 260 })
      .addTo(group);
  }
}
