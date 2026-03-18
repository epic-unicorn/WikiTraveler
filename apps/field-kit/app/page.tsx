"use client";

import { useState } from "react";
import Link from "next/link";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string; location: string }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const nodeUrl = process.env.NEXT_PUBLIC_NODE_API_URL ?? "http://localhost:3000";

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
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
              <p style={{ textAlign: "center", color: "#9ca3af", padding: "32px 0" }}>
                No properties found. Ask the node admin to seed more data.
              </p>
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
