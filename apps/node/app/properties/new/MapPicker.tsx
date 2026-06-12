"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  lat: number | null;
  lon: number | null;
  onPick: (pick: { lat: number; lon: number }) => void;
}

export function MapPicker({ lat, lon, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialLat = lat ?? 52.3676;
    const initialLon = lon ?? 4.9041;

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLon],
      zoom: lat != null ? 15 : 6,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    if (lat != null && lon != null) {
      markerRef.current = L.marker([lat, lon]).addTo(map);
    }

    map.on("click", (e) => {
      const { lat: clickLat, lng: clickLon } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng(e.latlng);
      } else {
        markerRef.current = L.marker(e.latlng).addTo(map);
      }
      onPick({ lat: clickLat, lon: clickLon });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (lat == null || lon == null || !mapRef.current) return;
    mapRef.current.setView([lat, lon], 15);
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      markerRef.current = L.marker([lat, lon]).addTo(mapRef.current);
    }
  }, [lat, lon]);

  return (
    <div
      ref={containerRef}
      style={{
        height: 220,
        width: "100%",
        borderRadius: "var(--wt-radius-md)",
        overflow: "hidden",
        border: "1px solid var(--wt-border)",
      }}
    />
  );
}
