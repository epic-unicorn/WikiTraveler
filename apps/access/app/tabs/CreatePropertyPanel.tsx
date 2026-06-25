"use client";

import { useState } from "react";
import { useLocale } from "@wikitraveler/ui";
import { getAuthHeaders, getAuthToken, invalidateMapPins } from "../lib/accessApi";
import { clearAuth } from "../lib/authStorage";

interface Props {
  searchNodeUrl: string;
  homeNodeUrl: string;
  defaultName?: string;
  onCancel?: () => void;
  onCreated: (propertyId: string) => void;
}

export function CreatePropertyPanel({
  searchNodeUrl,
  homeNodeUrl,
  defaultName = "",
  onCancel,
  onCreated,
}: Props) {
  const { t } = useLocale();
  const [name, setName] = useState(defaultName);
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        display_name?: string;
        address?: Record<string, string>;
      };
      const a = data.address ?? {};
      const street = [a.road, a.house_number].filter(Boolean).join(" ");
      const city = a.city ?? a.town ?? a.village ?? a.municipality ?? "";
      const concise = [street, [a.postcode, city].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");
      return concise || data.display_name || null;
    } catch {
      return null;
    }
  }

  async function forwardGeocode(address: string): Promise<{ lat: number; lon: number } | null> {
    const attempts = [
      address,
      /nederland|netherlands/i.test(address) ? "" : `${address}, Netherlands`,
    ].filter(Boolean);

    for (const query of attempts) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
          { headers: { Accept: "application/json", "User-Agent": "WikiTraveler-Access/0.2" } }
        );
        if (!res.ok) continue;
        const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
        const hit = data[0];
        if (!hit?.lat || !hit?.lon) continue;
        const parsedLat = Number(hit.lat);
        const parsedLon = Number(hit.lon);
        if (Number.isNaN(parsedLat) || Number.isNaN(parsedLon)) continue;
        return { lat: parsedLat, lon: parsedLon };
      } catch {
        continue;
      }
    }
    return null;
  }

  async function useMyLocation() {
    if (!navigator.geolocation) {
      setError(t("ui.createPropertyGeoUnsupported"));
      return;
    }
    setGeoLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLon(longitude);
        const address = await reverseGeocode(latitude, longitude);
        if (!location.trim()) {
          setLocation(address ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
        setGeoLoading(false);
      },
      () => {
        setError(t("ui.createPropertyGeoFailed"));
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function submit() {
    setError("");
    if (!name.trim() || !location.trim()) {
      setError(t("ui.createPropertyNameLocationRequired"));
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setError(t("ui.createPropertyNotLoggedIn"));
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        location: location.trim(),
      };
      let resolvedLat = lat;
      let resolvedLon = lon;
      // Without coordinates a property never shows on the map, only in the list.
      // If the user typed an address instead of using GPS, geocode it now.
      if (resolvedLat == null || resolvedLon == null) {
        const geo = await forwardGeocode(location.trim());
        if (geo) {
          resolvedLat = geo.lat;
          resolvedLon = geo.lon;
        }
      }
      if (resolvedLat != null && resolvedLon != null) {
        body.lat = resolvedLat;
        body.lon = resolvedLon;
      }

      const res = await fetch(`${searchNodeUrl}/api/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        clearAuth();
        setError(t("ui.createPropertySessionExpired"));
        return;
      }

      const data = (await res.json()) as { property?: { id: string }; message?: string };
      if (!res.ok) {
        setError(data.message ?? t("ui.createPropertyFailed"));
        return;
      }

      invalidateMapPins();
      onCreated(data.property!.id);
    } catch {
      setError(t("ui.createPropertyNodeUnreachable"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <label htmlFor="cp-name">{t("ui.createPropertyName")}</label>
      <input
        id="cp-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("ui.createPropertyNamePlaceholder")}
      />

      <label htmlFor="cp-location">{t("ui.createPropertyLocation")}</label>
      <input
        id="cp-location"
        type="text"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder={t("ui.createPropertyLocationPlaceholder")}
      />

      <button
        type="button"
        className="btn-secondary"
        style={{ marginTop: 12 }}
        onClick={useMyLocation}
        disabled={geoLoading}
      >
        {geoLoading ? t("ui.createPropertyGettingLocation") : `📍 ${t("ui.createPropertyUseLocation")}`}
      </button>

      {lat != null && lon != null && (
        <p className="status-muted" style={{ marginTop: 8, fontSize: 12 }}>
          {t("ui.createPropertyGps", { lat: lat.toFixed(5), lon: lon.toFixed(5) })}
        </p>
      )}

      {error && <p className="status-err">{error}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          className="btn-primary"
          style={{ flex: 1, marginTop: 0 }}
          onClick={submit}
          disabled={loading}
        >
          {loading ? t("ui.createPropertyCreating") : t("ui.createAndAudit")}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" style={{ marginTop: 0 }} onClick={onCancel}>
            {t("ui.cancel")}
          </button>
        )}
      </div>
    </div>
  );
}
