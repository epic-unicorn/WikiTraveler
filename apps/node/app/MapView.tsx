"use client";

import { useEffect, useRef, useState } from "react";

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

function buildPopup(pin: MapPin): string {
  const facts = pin.facts ?? {};
  const knownFields = Object.keys(FACT_LABELS);
  const factRows = knownFields
    .map((key) => {
      const fact = facts[key];
      if (!fact) return "";
      const icon = fact.value === "yes" ? "✅" : fact.value === "no" ? "❌" : "❓";
      return `<div style="font-size:12px;margin-top:3px">${icon} ${FACT_LABELS[key]}</div>`;
    })
    .filter(Boolean)
    .join("");

  const hasFacts = factRows.length > 0;

  return `
    <div style="min-width:180px;font-family:system-ui,sans-serif">
      <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:2px">${pin.name}</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:${hasFacts ? "8px" : "10px"}">📍 ${pin.location}</div>
      ${hasFacts ? `<div style="margin-bottom:10px">${factRows}</div>` : ""}
      <a href="/properties/${pin.id}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">
        View / Audit →
      </a>
    </div>
  `;
}

export function MapView({ focusPins, auditedOnly }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const allPinsRef = useRef<MapPin[]>([]);
  const layerGroupRef = useRef<unknown>(null);
  const leafletRef = useRef<unknown>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  // Initial mount: load all pins and render them
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    setStatus("loading");

    const token = (() => {
      const m = document.cookie.match(/(?:^|;\s*)wt_token=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    })();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    Promise.all([
      import("leaflet"),
      fetch("/api/properties/map", { headers }).then((r) => r.json() as Promise<{ pins: MapPin[] }>),
    ]).then(([L, data]) => {
      // Discard if the effect was cleaned up before the promise resolved
      if (cancelled || !containerRef.current || mapRef.current) return;

      const pins = (data.pins ?? []).filter((p) => p.lat !== 0 && p.lon !== 0);
      allPinsRef.current = pins;
      leafletRef.current = L;

      if (pins.length === 0) { setStatus("done"); return; }

      const map = (L as typeof import("leaflet")).map(containerRef.current, { preferCanvas: false }).setView([52.3, 5.3], 7);
      mapRef.current = map;

      (L as typeof import("leaflet")).tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const group = (L as typeof import("leaflet")).featureGroup();
      layerGroupRef.current = group;
      renderPins(L as typeof import("leaflet"), group, pins, false);
      group.addTo(map);

      if (pins.length > 1) map.fitBounds(group.getBounds(), { padding: [32, 32] });

      setStatus("done");
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
        layerGroupRef.current = null;
        allPinsRef.current = [];
        if (containerRef.current) {
          delete (containerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
        }
      }
    };
  }, []);

  // React to focusPins / auditedOnly changes
  useEffect(() => {
    const L = leafletRef.current as typeof import("leaflet") | null;
    const map = mapRef.current as import("leaflet").Map | null;
    const group = layerGroupRef.current as import("leaflet").FeatureGroup | null;
    if (!L || !map || !group) return;

    group.clearLayers();

    // When auditedOnly is on, dim pins that have not been field-audited.
    // The dim set is determined BEFORE checking focusPins.
    const auditDimIds = auditedOnly
      ? new Set(allPinsRef.current.filter((p) => !p.audited).map((p) => p.id))
      : null;

    if (!focusPins || focusPins.length === 0) {
      renderPins(L, group, allPinsRef.current, false, undefined, auditDimIds ?? undefined);
      if (allPinsRef.current.length > 1) map.fitBounds(group.getBounds(), { padding: [32, 32] });
    } else {
      const focusIds = new Set(focusPins.map((p) => p.id));
      // A pin is dim if it's not in the focus set OR if it's not audited (when filter is on)
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
        style={{ width: "100%", height: 420, borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb" }}
      />
      {status === "loading" && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center", background: "rgba(249,250,251,0.7)",
          borderRadius: 12, fontSize: 14, color: "#6b7280",
        }}>
          Loading map…
        </div>
      )}
    </div>
  );
}

function renderPins(
  L: typeof import("leaflet"),
  group: import("leaflet").FeatureGroup,
  pins: MapPin[],
  dimAll: boolean,
  highlightIds?: Set<string>,
  dimIds?: Set<string>
) {
  // Render dim pins first so highlighted always sit on top
  const isDim = (p: MapPin) =>
    dimIds ? dimIds.has(p.id) : (dimAll ? !(highlightIds?.has(p.id) ?? false) : false);
  const dimPins = pins.filter(isDim);
  const brightPins = pins.filter((p) => !isDim(p));

  for (const pin of dimPins) {
    L.circleMarker([pin.lat, pin.lon], {
      radius: 4,
      color: "#d1d5db",
      fillColor: "#e5e7eb",
      fillOpacity: 0.5,
      weight: 1,
    })
      .bindPopup(buildPopup(pin), { maxWidth: 260 })
      .addTo(group);
  }

  for (const pin of brightPins) {
    L.circleMarker([pin.lat, pin.lon], {
      radius: 8,
      color: "#1e3a5f",
      fillColor: "#60a5fa",
      fillOpacity: 0.9,
      weight: 2,
    })
      .bindPopup(buildPopup(pin), { maxWidth: 260 })
      .addTo(group);
  }
}
