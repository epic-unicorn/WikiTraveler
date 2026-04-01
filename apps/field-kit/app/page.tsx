"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string; location: string }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Create-property form state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createLocation, setCreateLocation] = useState("");
  const [createPassphrase, setCreatePassphrase] = useState("");
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const nodeUrl = process.env.NEXT_PUBLIC_NODE_API_URL ?? "http://localhost:3000";
  const router = useRouter();

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setShowCreate(false);
    try {
      const res = await fetch(`${nodeUrl}/api/properties?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json() as { properties: Array<{ id: string; name: string; location: string }> };
      setResults(data.properties ?? []);
    } catch {
      setError("Could not reach the node. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function createProperty() {
    setCreateError("");
    if (!createName.trim() || !createLocation.trim()) {
      setCreateError("Name and location are required.");
      return;
    }
    if (!createPassphrase.trim()) {
      setCreateError("Passphrase is required to create a property.");
      return;
    }
    setCreateLoading(true);
    try {
      // Obtain token
      const tokenRes = await fetch(`${nodeUrl}/api/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: createPassphrase }),
      });
      const tokenData = await tokenRes.json() as { token?: string; message?: string };
      if (!tokenRes.ok) {
        setCreateError(tokenData.message ?? "Invalid passphrase");
        return;
      }

      // Create property
      const createRes = await fetch(`${nodeUrl}/api/properties`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenData.token}`,
        },
        body: JSON.stringify({ name: createName.trim(), location: createLocation.trim() }),
      });
      const createData = await createRes.json() as { property?: { id: string }; message?: string };
      if (!createRes.ok) {
        setCreateError(createData.message ?? "Failed to create property");
        return;
      }
      router.push(`/audit/${createData.property!.id}`);
    } catch {
      setCreateError("Could not reach the node. Check your connection.");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <>
      <header>
        <span style={{ fontSize: 24 }}>🔍</span>
        <h1>WikiTraveler Field Kit</h1>
      </header>

      <main className="page">
        <div className="card">
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
            Search for a property to start your on-site accessibility audit.
          </p>
          <label htmlFor="search">Property name or location</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="search"
              type="text"
              placeholder='e.g. "Grand Hotel Vienna"'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              style={{ flex: 1 }}
            />
            <button
              onClick={search}
              disabled={loading}
              style={{
                background: "#1e3a5f", color: "#fff", border: "none",
                borderRadius: 10, padding: "0 18px", cursor: "pointer",
                fontWeight: 700, fontSize: 20,
              }}
            >
              {loading ? "…" : "→"}
            </button>
          </div>
          {error && <p className="status-err">{error}</p>}
        </div>

        {results !== null && (
          <div style={{ marginTop: 20 }}>
            {results.length === 0 ? (
              <div>
                <p style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0 16px" }}>
                  No properties found for &ldquo;{query}&rdquo;.
                </p>
                {!showCreate ? (
                  <button
                    onClick={() => { setShowCreate(true); setCreateName(query); }}
                    style={{
                      width: "100%", padding: "12px", borderRadius: 10,
                      border: "2px dashed #1e3a5f", background: "transparent",
                      color: "#1e3a5f", fontWeight: 600, fontSize: 15, cursor: "pointer",
                    }}
                  >
                    + Add &ldquo;{query}&rdquo; to the database
                  </button>
                ) : (
                  <div className="card" style={{ marginTop: 8 }}>
                    <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>New property</p>
                    <label htmlFor="create-name">Name</label>
                    <input
                      id="create-name"
                      type="text"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder='e.g. "Hotel Example"'
                      style={{ marginBottom: 10 }}
                    />
                    <label htmlFor="create-location">Location</label>
                    <input
                      id="create-location"
                      type="text"
                      value={createLocation}
                      onChange={(e) => setCreateLocation(e.target.value)}
                      placeholder='e.g. "Main Street 1, Amsterdam"'
                      style={{ marginBottom: 10 }}
                    />
                    <label htmlFor="create-passphrase">Community passphrase</label>
                    <input
                      id="create-passphrase"
                      type="password"
                      value={createPassphrase}
                      onChange={(e) => setCreatePassphrase(e.target.value)}
                      placeholder="Enter passphrase"
                      style={{ marginBottom: 10 }}
                    />
                    {createError && <p className="status-err">{createError}</p>}
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button
                        onClick={createProperty}
                        disabled={createLoading}
                        style={{
                          flex: 1, background: "#1e3a5f", color: "#fff",
                          border: "none", borderRadius: 10, padding: "10px",
                          fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        {createLoading ? "Creating…" : "Create & start audit"}
                      </button>
                      <button
                        onClick={() => setShowCreate(false)}
                        style={{
                          background: "transparent", border: "1px solid #d1d5db",
                          borderRadius: 10, padding: "10px 14px", cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              results.map((p) => (
                <Link key={p.id} href={`/audit/${p.id}`} style={{ display: "block" }}>
                  <div
                    className="card"
                    style={{ marginTop: 12, cursor: "pointer", transition: "border-color 0.15s" }}
                  >
                    <p style={{ fontWeight: 600, fontSize: 16 }}>{p.name}</p>
                    <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>📍 {p.location}</p>
                    <p style={{ color: "#1e3a5f", fontSize: 13, marginTop: 8, fontWeight: 600 }}>
                      Start audit →
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        <div
          style={{
            marginTop: 32, padding: "16px 20px",
            background: "#eff6ff", borderRadius: 12,
            border: "1px solid #bfdbfe",
          }}
        >
          <p style={{ fontSize: 13, color: "#1e40af" }}>
            <strong>Node:</strong> <code style={{ fontSize: 12 }}>{nodeUrl}</code>
          </p>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Set <code>NEXT_PUBLIC_NODE_API_URL</code> to point to a different node.
          </p>
        </div>
      </main>
    </>
  );
}
