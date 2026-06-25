"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@wikitraveler/ui";
import {
  fetchNearbyProperties,
  getStoredRadiusKm,
  setStoredRadiusKm,
  resolvePeerNode,
} from "../lib/accessApi";
import { PropertyDiscoveryView } from "../components/PropertyDiscoveryView";

interface Props {
  searchNodeUrl: string;
  homeNodeUrl: string;
  active: boolean;
}

const RADIUS_PRESETS = [0.5, 1, 2, 5];

export function NearbyTab({ searchNodeUrl, homeNodeUrl, active }: Props) {
  const { t } = useLocale();
  const [radiusKm, setRadiusKm] = useState(1);
  const [showAdvancedRadius, setShowAdvancedRadius] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [nodeForSearch, setNodeForSearch] = useState(searchNodeUrl);
  const [results, setResults] = useState<Awaited<ReturnType<typeof fetchNearbyProperties>> | null>(null);
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

  const headerExtra = (
    <div className="fk-nearby-controls">
      <div className="fk-nearby-status-row">
        {geoDenied ? (
          <span className="fk-chip fk-chip--err">{t("ui.nearbyGpsDenied")}</span>
        ) : gpsLoading ? (
          <span className="fk-chip fk-chip--warn">{t("ui.nearbyLocating")}</span>
        ) : coords ? (
          <span className="fk-chip fk-chip--ok">{t("ui.discoveryYouAreHere")}</span>
        ) : (
          <span className="fk-chip fk-chip--neutral">{t("ui.nearbyLocating")}</span>
        )}
        {coords && (
          <button
            type="button"
            className="btn-icon"
            onClick={() => loadNearby()}
            disabled={loading}
            title={t("ui.discoveryRefresh")}
            aria-label={t("ui.discoveryRefresh")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        )}
      </div>

      <div className="fk-nearby-radius">
        <span className="fk-nearby-radius-label">{t("ui.nearbyRadius")}</span>
        <div className="fk-nearby-radius-chips" role="group" aria-label={t("ui.nearbyRadius")}>
          {RADIUS_PRESETS.map((km) => (
            <button
              key={km}
              type="button"
              className={`fk-radius-chip${radiusKm === km ? " fk-radius-chip--active" : ""}`}
              aria-pressed={radiusKm === km}
              onClick={() => handleRadiusChange(km)}
            >
              {km < 1 ? `${km * 1000} m` : `${km} km`}
            </button>
          ))}
          <button
            type="button"
            className="fk-radius-chip fk-radius-chip--more"
            aria-expanded={showAdvancedRadius}
            onClick={() => setShowAdvancedRadius((v) => !v)}
          >
            …
          </button>
        </div>
        {showAdvancedRadius && (
          <div className="fk-nearby-radius-slider">
            <input
              id="radius"
              type="range"
              min={0.5}
              max={5}
              step={0.5}
              value={radiusKm}
              onChange={(e) => handleRadiusChange(Number(e.target.value))}
              aria-valuetext={`${radiusKm} km`}
            />
          </div>
        )}
      </div>

      {geoDenied && (
        <button type="button" className="btn-secondary fk-nearby-allow-btn" onClick={requestGps}>
          📍 {t("ui.nearbyAllowLocation")}
        </button>
      )}
    </div>
  );

  const emptyState =
    !loading && results !== null && results.length === 0 ? (
      <div className="fk-empty">
        <span className="fk-empty-icon">📍</span>
        <p className="fk-empty-title">{t("ui.nearbyNothing")}</p>
        <p className="fk-empty-body">{t("ui.discoveryNearbyEmpty", { radius: radiusKm })}</p>
        {radiusKm < 5 && (
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => handleRadiusChange(Math.min(5, radiusKm + 1))}
          >
            {t("ui.discoveryIncreaseRadius")}
          </button>
        )}
      </div>
    ) : !loading && results === null && !geoDenied && !gpsLoading && !error ? (
      <div className="fk-empty">
        <span className="fk-empty-icon">🛰️</span>
        <p className="fk-empty-title">{t("ui.nearbyLocating")}</p>
        <p className="fk-empty-body">{t("ui.nearbyAllowLocation")}</p>
      </div>
    ) : null;

  return (
    <div className="tab-content fk-nearby-tab">
      <PropertyDiscoveryView
        properties={results ?? []}
        loading={loading || gpsLoading}
        error={error}
        homeNodeUrl={homeNodeUrl}
        propertyNodeUrl={nodeForSearch}
        active={active}
        userLocation={coords}
        radiusKm={coords ? radiusKm : null}
        headerExtra={headerExtra}
        emptyState={emptyState}
        mapAutoFit
      />
    </div>
  );
}
