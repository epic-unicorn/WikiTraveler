"use client";

import { useEffect, useRef } from "react";
import { useTheme, useLocale } from "@wikitraveler/ui";

interface Props {
  lat: number;
  lon: number;
  name: string;
}

/** Compact static-feeling map pin for property detail sheet. */
export function PropertyMiniMap({ lat, lon, name }: Props) {
  const { mode } = useTheme();
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
      }).setView([lat, lon], 15);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      L.circleMarker([lat, lon], {
        radius: 8,
        color: "#1e40af",
        fillColor: "#60a5fa",
        fillOpacity: 0.95,
        weight: 2,
      })
        .bindTooltip(name, { direction: "top", offset: [0, -8] })
        .addTo(map);

      mapRef.current = map;
      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lon, name, mode]);

  const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;

  return (
    <a
      className="fk-property-mini-map"
      href={osmUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("ui.discoveryShowOnMap")}
      title={t("ui.discoveryShowOnMap")}
    >
      <div ref={containerRef} className="fk-property-mini-map__canvas" aria-hidden="true" />
    </a>
  );
}
