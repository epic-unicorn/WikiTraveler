"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PropertyCard, useLocale, type PropertySummary } from "@wikitraveler/ui";
import {
  fetchNearbyProperties,
  getStoredRadiusKm,
  setStoredRadiusKm,
  resolvePeerNode,
} from "../lib/accessApi";
import { propertyHref } from "../lib/propertyHref";

interface Props {
  searchNodeUrl: string;
  homeNodeUrl: string;
  active: boolean;
}

export function NearbyTab({ searchNodeUrl, homeNodeUrl, active }: Props) {
  const { t } = useLocale();
  const [radiusKm, setRadiusKm] = useState(1);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [nodeForSearch, setNodeForSearch] = useState(searchNodeUrl);
  const [results, setResults] = useState<PropertySummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [geoDenied, setGeoDenied] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    setRadiusKm(getStoredRadiusKm());
  }, []);

  useEffect(() => {
    setNodeForSearch(searchNodeUrl);
  }, [searchNodeUrl]);

  const loadNearby = useCallback(async (signal?: AbortSignal) => {
    if (!coords) return;
    setLoading(true);
    setError("");
    try {
      let node = homeNodeUrl;
      const peer = await resolvePeerNode(homeNodeUrl, coords.lat, coords.lon);
      if (signal?.aborted) return;
      if (peer?.url) node = peer.url;
      setNodeForSearch(node);
      const properties = await fetchNearbyProperties(node, coords.lat, coords.lon, radiusKm, signal);
      if (signal?.aborted) return;
      setResults(properties);
    } catch {
      if (signal?.aborted) return;
      setError(t("ui.searchNodeUnreachable"));
      setResults(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [coords, radiusKm, homeNodeUrl, t]);

  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoDenied(true);
      return;
    }
    setGpsLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoDenied(false);
        setGpsLoading(false);
      },
      () => {
        setGeoDenied(true);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (!active || coords) return;
    requestGps();
  }, [active, coords, requestGps]);

  useEffect(() => {
    if (!active || !coords) return;
    const controller = new AbortController();
    loadNearby(controller.signal);
    return () => controller.abort();
  }, [active, coords, radiusKm, loadNearby]);

  function handleRadiusChange(km: number) {
    setStoredRadiusKm(km);
    setRadiusKm(km);
  }

  return (
    <div className="tab-content" style={{ paddingTop: 16 }}>
      {/* GPS + refresh row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          {geoDenied ? (
            <span className="fk-chip fk-chip--err">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              {t("ui.nearbyGpsDenied")}
            </span>
          ) : gpsLoading ? (
            <span className="fk-chip fk-chip--warn">{t("ui.nearbyLocating")}</span>
          ) : coords ? (
            <span className="fk-chip fk-chip--ok">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}
            </span>
          ) : (
            <span className="fk-chip fk-chip--neutral">No GPS yet</span>
          )}
        </div>

        {coords && (
          <button
            type="button"
            className="btn-icon"
            onClick={() => loadNearby()}
            disabled={loading}
            title="Refresh nearby"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        )}
      </div>

      {/* Radius slider */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label htmlFor="radius" style={{ margin: 0, fontSize: 13 }}>{t("ui.nearbyRadius")}</label>
          <span className="fk-chip fk-chip--neutral">{radiusKm} km</span>
        </div>
        <input
          id="radius"
          type="range"
          min={0.5}
          max={5}
          step={0.5}
          value={radiusKm}
          onChange={(e) => handleRadiusChange(Number(e.target.value))}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 11, color: "var(--wt-text-muted)" }}>0.5 km</span>
          <span style={{ fontSize: 11, color: "var(--wt-text-muted)" }}>5 km</span>
        </div>
      </div>

      {/* GPS denied prompt */}
      {geoDenied && (
        <button type="button" className="btn-secondary" style={{ marginTop: 0 }} onClick={requestGps}>
          📍 {t("ui.nearbyAllowLocation")}
        </button>
      )}

      {/* Loading */}
      {loading && (
        <p className="status-muted" style={{ textAlign: "center", padding: "28px 0" }}>
          {t("ui.nearbyFinding")}
        </p>
      )}

      {/* Error */}
      {error && <p className="status-err">{error}</p>}

      {/* Empty result */}
      {!loading && results !== null && results.length === 0 && (
        <div className="fk-empty">
          <span className="fk-empty-icon">📍</span>
          <p className="fk-empty-title">{t("ui.nearbyNothing")}</p>
          <p className="fk-empty-body">
            No geo-tagged properties within {radiusKm} km. Try increasing the radius.
          </p>
        </div>
      )}

      {/* No GPS yet */}
      {!loading && results === null && !geoDenied && !gpsLoading && !error && (
        <div className="fk-empty">
          <span className="fk-empty-icon">🛰️</span>
          <p className="fk-empty-title">{t("ui.nearbyLocating")}</p>
          <p className="fk-empty-body">{t("ui.nearbyAllowLocation")}</p>
        </div>
      )}

      {/* Results */}
      {results !== null && results.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {results.map((p) => (
            <Link key={p.id} href={propertyHref(p.id, nodeForSearch, homeNodeUrl)}>
              <PropertyCard property={p} expandable={false} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
