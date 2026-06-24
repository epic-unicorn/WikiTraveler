"use client";

import { useState } from "react";
import { getAuthHeaders, getAuthToken } from "../lib/accessApi";
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
  const [name, setName] = useState(defaultName);
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation not supported.");
      return;
    }
    setGeoLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLon(pos.coords.longitude);
        if (!location.trim()) {
          setLocation(
            `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`
          );
        }
        setGeoLoading(false);
      },
      () => {
        setError("Could not get your location.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function submit() {
    setError("");
    if (!name.trim() || !location.trim()) {
      setError("Name and location are required.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setError("Not logged in.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        location: location.trim(),
      };
      if (lat != null && lon != null) {
        body.lat = lat;
        body.lon = lon;
      }

      const res = await fetch(`${searchNodeUrl}/api/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        clearAuth();
        setError("Session expired — please sign in again.");
        return;
      }

      const data = (await res.json()) as { property?: { id: string }; message?: string };
      if (!res.ok) {
        setError(data.message ?? "Failed to create property");
        return;
      }

      onCreated(data.property!.id);
    } catch {
      setError("Could not reach the node.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <label htmlFor="cp-name">Name</label>
      <input
        id="cp-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Hotel Example"
      />

      <label htmlFor="cp-location">Location</label>
      <input
        id="cp-location"
        type="text"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="City, address, or region"
      />

      <button
        type="button"
        className="btn-secondary"
        style={{ marginTop: 12 }}
        onClick={useMyLocation}
        disabled={geoLoading}
      >
        {geoLoading ? "Getting location…" : "📍 Use my location"}
      </button>

      {lat != null && lon != null && (
        <p className="status-muted" style={{ marginTop: 8, fontSize: 12 }}>
          GPS: {lat.toFixed(5)}, {lon.toFixed(5)}
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
          {loading ? "Creating…" : "Create & audit"}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" style={{ marginTop: 0 }} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
