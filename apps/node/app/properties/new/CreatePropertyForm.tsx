"use client";

import { useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const MapPicker = dynamic(() => import("./MapPicker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 220,
        background: "var(--wt-bg-elevated)",
        border: "1px solid var(--wt-border)",
        borderRadius: "var(--wt-radius-md)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--wt-text-muted)",
        fontSize: 14,
      }}
    >
      Loading map…
    </div>
  ),
});

function CreatePropertyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState(searchParams.get("name") ?? "");
  const [location, setLocation] = useState("");
  const [canonicalId, setCanonicalId] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleMapPick = useCallback((pick: { lat: number; lon: number }) => {
    setLat(pick.lat);
    setLon(pick.lon);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        location: location.trim(),
      };
      if (canonicalId.trim()) body.canonicalId = canonicalId.trim();
      if (lat != null && lon != null) {
        body.lat = lat;
        body.lon = lon;
      }

      const m = document.cookie.match(/(?:^|;\s*)wt_token=([^;]+)/);
      const token = m ? decodeURIComponent(m[1]) : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch("/api/properties", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { property?: { id: string }; message?: string };
      if (!res.ok) {
        setError(data.message ?? "Could not create property");
        return;
      }
      router.push(`/properties/${data.property!.id}`);
    } catch {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 13px",
    border: "1.5px solid var(--wt-border)",
    borderRadius: "var(--wt-radius-sm)",
    fontSize: 15,
    outline: "none",
    fontFamily: "inherit",
    background: "var(--wt-bg-elevated)",
    color: "var(--wt-text)",
  };

  return (
    <div
      style={{
        background: "var(--wt-bg-elevated)",
        border: "1px solid var(--wt-border)",
        borderRadius: "var(--wt-radius-lg)",
        padding: "28px 24px",
        boxShadow: "var(--wt-shadow)",
      }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>New property</h2>
      <p style={{ fontSize: 14, color: "var(--wt-text-muted)", marginBottom: 24 }}>
        Add a property to the database, then complete an accessibility audit.
      </p>

      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        <label style={labelStyle}>Location *</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, address, or region"
          required
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        <label style={labelStyle}>Canonical ID (optional)</label>
        <input
          type="text"
          value={canonicalId}
          onChange={(e) => setCanonicalId(e.target.value)}
          placeholder="local:… or external ID"
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            style={{
              ...inputStyle,
              width: "auto",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              padding: "8px 14px",
            }}
          >
            {showMap ? "Hide map" : lat != null ? "Adjust map pin" : "Pick location on map"}
          </button>
          {lat != null && lon != null && (
            <p style={{ fontSize: 12, color: "var(--wt-text-muted)", marginTop: 8 }}>
              Pin: {lat.toFixed(5)}, {lon.toFixed(5)}
            </p>
          )}
        </div>

        {showMap && (
          <div style={{ marginBottom: 20 }}>
            <MapPicker
              lat={lat}
              lon={lon}
              onPick={handleMapPick}
            />
          </div>
        )}

        {error && (
          <p style={{ color: "var(--wt-danger)", fontSize: 13, marginBottom: 12 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            background: "var(--wt-primary)",
            color: "var(--wt-primary-contrast)",
            border: "none",
            borderRadius: "var(--wt-radius-sm)",
            padding: "12px",
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Creating…" : "Create & audit"}
        </button>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--wt-text-muted)",
  marginBottom: 5,
};

export default function CreatePropertyPageClient() {
  return (
    <Suspense>
      <CreatePropertyForm />
    </Suspense>
  );
}
