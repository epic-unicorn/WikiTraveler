"use client";

import { useEffect, useRef } from "react";
import type { Bbox } from "@/lib/bbox";
import { bboxAreaKm2, formatBbox, parseBbox, planTileIngest, validateBbox } from "@/lib/bbox";

import "leaflet/dist/leaflet.css";

interface Props {
  bbox: string | null;
  onChange: (bbox: string) => void;
  presetBbox?: string | null;
}

export function RegionMapEditor({ bbox, onChange, presetBbox }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const rectRef = useRef<import("leaflet").Rectangle | null>(null);
  const corner1Ref = useRef<{ lat: number; lon: number } | null>(null);
  const tempRectRef = useRef<import("leaflet").Rectangle | null>(null);
  const drawingRef = useRef(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    let leaflet: typeof import("leaflet") | null = null;

    const finishDraw = (lat: number, lon: number) => {
      const map = mapRef.current;
      const L = leaflet;
      const c1 = corner1Ref.current;
      if (!map || !L || !c1) return;

      drawingRef.current = false;
      corner1Ref.current = null;
      map.dragging.enable();

      const b: Bbox = [
        Math.min(c1.lat, lat),
        Math.min(c1.lon, lon),
        Math.max(c1.lat, lat),
        Math.max(c1.lon, lon),
      ];

      if (tempRectRef.current) {
        tempRectRef.current.remove();
        tempRectRef.current = null;
      }

      if (rectRef.current) rectRef.current.remove();
      rectRef.current = L.rectangle(
        [
          [b[0], b[1]],
          [b[2], b[3]],
        ],
        { color: "#2563eb", weight: 2, fillOpacity: 0.15 }
      ).addTo(map);

      onChangeRef.current(formatBbox(b));
    };

    const cancelDraw = () => {
      drawingRef.current = false;
      corner1Ref.current = null;
      mapRef.current?.dragging.enable();
      if (tempRectRef.current) {
        tempRectRef.current.remove();
        tempRectRef.current = null;
      }
    };

    const onDocumentMouseUp = (ev: MouseEvent) => {
      if (!drawingRef.current || !mapRef.current || !leaflet) return;
      const map = mapRef.current;
      const point = map.mouseEventToLatLng(ev);
      finishDraw(point.lat, point.lng);
    };

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      leaflet = L;

      const initial = parseBbox(bbox ?? presetBbox ?? "51.44,5.47,51.48,5.52");
      const center = initial
        ? [(initial[0] + initial[2]) / 2, (initial[1] + initial[3]) / 2] as [number, number]
        : ([52.3, 5.3] as [number, number]);

      const map = L.map(containerRef.current, { boxZoom: false }).setView(center, initial ? 11 : 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      if (initial) {
        const rect = L.rectangle(
          [
            [initial[0], initial[1]],
            [initial[2], initial[3]],
          ],
          { color: "#2563eb", weight: 2, fillOpacity: 0.15 }
        ).addTo(map);
        rectRef.current = rect;
        map.fitBounds(rect.getBounds(), { padding: [20, 20] });
      }

      map.on("mousedown", (e: import("leaflet").LeafletMouseEvent) => {
        if (e.originalEvent.button !== 0) return;
        if (!e.originalEvent.shiftKey) return;

        L.DomEvent.stopPropagation(e.originalEvent);
        L.DomEvent.preventDefault(e.originalEvent);

        drawingRef.current = true;
        corner1Ref.current = { lat: e.latlng.lat, lon: e.latlng.lng };
        map.dragging.disable();

        if (tempRectRef.current) {
          tempRectRef.current.remove();
          tempRectRef.current = null;
        }
      });

      map.on("mousemove", (e: import("leaflet").LeafletMouseEvent) => {
        if (!drawingRef.current || !corner1Ref.current) return;
        const c1 = corner1Ref.current;
        const bounds: [[number, number], [number, number]] = [
          [Math.min(c1.lat, e.latlng.lat), Math.min(c1.lon, e.latlng.lng)],
          [Math.max(c1.lat, e.latlng.lat), Math.max(c1.lon, e.latlng.lng)],
        ];
        if (tempRectRef.current) tempRectRef.current.setBounds(bounds);
        else {
          tempRectRef.current = L.rectangle(bounds, {
            color: "#16a34a",
            weight: 2,
            dashArray: "6 4",
            fillOpacity: 0.1,
          }).addTo(map);
        }
      });

      map.on("mouseup", (e: import("leaflet").LeafletMouseEvent) => {
        if (!drawingRef.current) return;
        L.DomEvent.stopPropagation(e.originalEvent);
        finishDraw(e.latlng.lat, e.latlng.lng);
      });

      document.addEventListener("mouseup", onDocumentMouseUp);
    });

    return () => {
      cancelled = true;
      document.removeEventListener("mouseup", onDocumentMouseUp);
      cancelDraw();
      mapRef.current?.remove();
      mapRef.current = null;
      rectRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map init once
  }, []);

  useEffect(() => {
    const parsed = parseBbox(presetBbox ?? null);
    if (!parsed || !mapRef.current) return;

    void import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;

      if (rectRef.current) rectRef.current.remove();
      rectRef.current = L.rectangle(
        [
          [parsed[0], parsed[1]],
          [parsed[2], parsed[3]],
        ],
        { color: "#2563eb", weight: 2, fillOpacity: 0.15 }
      ).addTo(map);
      map.fitBounds(rectRef.current.getBounds(), { padding: [20, 20] });
      onChangeRef.current(formatBbox(parsed));
    });
  }, [presetBbox]);

  const parsed = parseBbox(bbox);
  const area = parsed ? Math.round(bboxAreaKm2(parsed)) : null;
  const tilePlan = parsed ? planTileIngest(parsed) : null;
  const invalid = bbox ? !validateBbox(bbox).ok : false;

  return (
    <div>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
        Hold <kbd style={{ fontSize: 12, padding: "1px 5px", borderRadius: 4, border: "1px solid #d1d5db", background: "#f9fafb" }}>Shift</kbd> and drag on the map to draw your region. Without Shift, drag pans the map.
      </p>
      <div
        ref={containerRef}
        style={{ height: 360, borderRadius: 10, border: "1px solid #e5e7eb", zIndex: 0 }}
      />
      {bbox && (
        <p style={{ fontSize: 12, color: invalid ? "#dc2626" : "#374151", marginTop: 8, fontFamily: "monospace" }}>
          {bbox}
          {area != null && <span style={{ fontFamily: "inherit", marginLeft: 8 }}>({area} km²)</span>}
          {tilePlan && tilePlan.tileCount > 1 && (
            <span style={{ fontFamily: "inherit", marginLeft: 8 }}>· {tilePlan.tileCount} tiles</span>
          )}
        </p>
      )}
      {invalid && (
        <p style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>
          Region exceeds tile limit — draw a smaller area.
        </p>
      )}
    </div>
  );
}
