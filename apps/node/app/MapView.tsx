"use client";

import { useEffect, useRef, useState } from "react";

export interface MapPin {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

interface Props {
  /** When provided, zoom to and highlight only these pins. Pass null to reset to all. */
  focusPins?: MapPin[] | null;
}

export function MapView({ focusPins }: Props) {
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

    Promise.all([
      import("leaflet"),
      fetch("/api/properties/map").then((r) => r.json() as Promise<{ pins: MapPin[] }>),
    ]).then(([L, data]) => {
      // Discard if the effect was cleaned up before the promise resolved
      if (cancelled || !containerRef.current || mapRef.current) return;

      const pins = data.pins.filter((p) => p.lat !== 0 && p.lon !== 0);
      allPinsRef.current = pins;
      leafletRef.current = L;

      if (pins.length === 0) { setStatus("done"); return; }

      const map = (L as typeof import("leaflet")).map(containerRef.current, { preferCanvas: true }).setView([52.3, 5.3], 7);
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
        // Leaflet marks the container with _leaflet_id; clear it so a
        // re-mount (e.g. React StrictMode double-invoke) doesn't throw
        // "Map container is already initialized."
        if (containerRef.current) {
          delete (containerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
        }
      }
    };
  }, []);

  // React to focusPins changes
  useEffect(() => {
    const L = leafletRef.current as typeof import("leaflet") | null;
    const map = mapRef.current as import("leaflet").Map | null;
    const group = layerGroupRef.current as import("leaflet").FeatureGroup | null;
    if (!L || !map || !group) return;

    group.clearLayers();

    if (!focusPins || focusPins.length === 0) {
      // Reset: show all pins
      renderPins(L, group, allPinsRef.current, false);
      if (allPinsRef.current.length > 1) map.fitBounds(group.getBounds(), { padding: [32, 32] });
    } else {
      const focusIds = new Set(focusPins.map((p) => p.id));
      // Dim all pins, highlight matched
      renderPins(L, group, allPinsRef.current, true, focusIds);
      const validFocus = focusPins.filter((p) => p.lat !== 0 && p.lon !== 0);
      if (validFocus.length === 1) {
        map.setView([validFocus[0].lat, validFocus[0].lon], 13);
      } else if (validFocus.length > 1) {
        const bounds = L.featureGroup(validFocus.map((p) => L.circleMarker([p.lat, p.lon]))).getBounds();
        map.fitBounds(bounds, { padding: [48, 48] });
      }
    }
  }, [focusPins]);

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
  highlightIds?: Set<string>
) {
  for (const pin of pins) {
    const highlighted = !dimAll || (highlightIds?.has(pin.id) ?? false);
    L.circleMarker([pin.lat, pin.lon], {
      radius: highlighted ? 7 : 4,
      color: highlighted ? "#1e3a5f" : "#d1d5db",
      fillColor: highlighted ? "#60a5fa" : "#e5e7eb",
      fillOpacity: highlighted ? 0.9 : 0.5,
      weight: highlighted ? 1.5 : 1,
    })
      .bindPopup(`<strong>${pin.name}</strong>`)
      .addTo(group);
  }
}
