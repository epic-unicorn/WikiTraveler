"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const ENV_NODE_URL = process.env.NEXT_PUBLIC_NODE_API_URL ?? "http://localhost:3000";

interface Property { id: string; name: string; location: string; }
interface NodeInfo { nodeId?: string; region?: string; version?: string; }

export default function SearchPage() {
  const router = useRouter();

  // Node URL (persisted in localStorage)
  const [nodeUrl, setNodeUrl] = useState(ENV_NODE_URL);
  // Resolved peer node for the user's current GPS location — may differ from home node
  const [searchNodeUrl, setSearchNodeUrl] = useState(ENV_NODE_URL);
  const [gpsResolved, setGpsResolved] = useState<{ region: string | null } | null>(null);
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [nodeReachable, setNodeReachable] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsUrl, setSettingsUrl] = useState(ENV_NODE_URL);
  const [settingsError, setSettingsError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("wt_node_url");
    if (stored) { setNodeUrl(stored); setSettingsUrl(stored); }
  }, []);

  useEffect(() => {
    setNodeInfo(null);
    setNodeReachable(null);
    fetch(`${nodeUrl}/api/nodeinfo`, { signal: AbortSignal.timeout(4000) })
      .then((r) => r.json())
      .then((d: NodeInfo) => { setNodeInfo(d); setNodeReachable(true); })
      .catch(() => setNodeReachable(false));
  }, [nodeUrl]);

  // GPS-based peer resolution — find the best regional node for the user's location
  useEffect(() => {
    setSearchNodeUrl(nodeUrl);
    setGpsResolved(null);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `${nodeUrl}/api/peers/resolve?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`,
            { signal: AbortSignal.timeout(4000) }
          );
          if (!res.ok) return;
          const data = await res.json() as { url: string; region?: string | null; matched: string };
          if (data.url !== nodeUrl) {
            setSearchNodeUrl(data.url);
            setGpsResolved({ region: data.region ?? null });
          }
        } catch { /* ignore */ }
      },
      () => { /* permission denied — silently continue with home node */ }
    );
  }, [nodeUrl]);

  function saveSettings() {
    const trimmed = settingsUrl.trim().replace(/\/$/, "");
    try { new URL(trimmed); } catch { setSettingsError("Invalid URL."); return; }
    localStorage.setItem("wt_node_url", trimmed);
    setNodeUrl(trimmed);
    setSettingsError("");
    setShowSettings(false);
  }

  function resetSettings() {
    localStorage.removeItem("wt_node_url");
    setNodeUrl(ENV_NODE_URL);
    setSettingsUrl(ENV_NODE_URL);
    setSettingsError("");
    setShowSettings(false);
  }

  // Search (type-to-search, debounced 350ms)
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [results, setResults] = useState<Property[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    if (!query.trim()) { setResults(null); setLoading(false); return; }

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const res = await fetch(
          `${searchNodeUrl}/api/properties?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error();
        const data = await res.json() as { properties: Property[] };
        setResults(data.properties ?? []);
        setLocationFilter("");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setSearchError("Could not reach the node. Check settings.");
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, searchNodeUrl]);

  const locations = results
    ? [...new Set(results.map((p) => p.location).filter(Boolean))].sort()
    : [];
  const filtered = results
    ? locationFilter ? results.filter((p) => p.location === locationFilter) : results
    : null;

  // Create property
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createLocation, setCreateLocation] = useState("");
  const [hasSavedToken, setHasSavedToken] = useState(() =>
    typeof window !== "undefined" ? !!sessionStorage.getItem("wt_auth_token") : false
  );
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Recently audited properties (from localStorage)
  const [recentAudits, setRecentAudits] = useState<Array<{ id: string; name: string; location: string; auditedAt: string }>>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("wt_recent_audits");
      if (stored) setRecentAudits(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  async function createProperty() {
    setCreateError("");
    if (!createName.trim() || !createLocation.trim()) {
      setCreateError("Name and location are required."); return;
    }
    setCreateLoading(true);
    try {
      const token = sessionStorage.getItem("wt_auth_token");
      if (!token) {
        setCreateError("You must be logged in. Open any property to log in first."); setCreateLoading(false); return;
      }
      const createRes = await fetch(`${searchNodeUrl}/api/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: createName.trim(), location: createLocation.trim() }),
      });
      if (createRes.status === 401) {
        sessionStorage.removeItem("wt_auth_token");
        setHasSavedToken(false);
        setCreateError("Session expired — please log in again.");
        return;
      }
      const createData = await createRes.json() as { property?: { id: string }; message?: string };
      if (!createRes.ok) { setCreateError(createData.message ?? "Failed to create property"); return; }
      const nodeParam = searchNodeUrl !== nodeUrl ? `?node=${encodeURIComponent(searchNodeUrl)}` : "";
      router.push(`/audit/${createData.property!.id}${nodeParam}`);
    } catch {
      setCreateError("Could not reach the node. Check settings.");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <>
      {/* Settings overlay */}
      {showSettings && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", display: "flex", flexDirection: "column" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
        >
          <div style={{ background: "#fff", padding: "20px 16px 24px", borderBottomLeftRadius: 18, borderBottomRightRadius: 18, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>Settings</h2>
              <button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>×</button>
            </div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Node URL</label>
            <input
              type="url"
              value={settingsUrl}
              onChange={(e) => setSettingsUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveSettings()}
              style={{ width: "100%", padding: "11px 13px", border: "1.5px solid #d1d5db", borderRadius: 10, fontSize: 15, boxSizing: "border-box", background: "#f9fafb" }}
            />
            {settingsError && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 6 }}>{settingsError}</p>}
            {nodeInfo && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12, color: "#374151" }}>
                <p>Connected · <strong>{nodeInfo.region ?? "Global"}</strong></p>
                <p style={{ marginTop: 3, color: "#6b7280" }}>{nodeInfo.nodeId} · v{nodeInfo.version}</p>
              </div>
            )}
            {nodeReachable === false && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#ef4444" }}>
                Cannot reach node at this URL.
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={saveSettings} style={{ flex: 2, background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontWeight: 700, cursor: "pointer", fontSize: 15 }}>Save</button>
              <button onClick={resetSettings} style={{ flex: 1, background: "transparent", border: "1px solid #d1d5db", borderRadius: 10, padding: "11px", cursor: "pointer", fontSize: 13, color: "#374151" }}>Reset</button>
            </div>
          </div>
        </div>
      )}

      <header>
        <span style={{ fontSize: 22 }}>🌍</span>
        <div style={{ flex: 1 }}>
          <h1>Field Kit</h1>
          {nodeInfo?.region && (
            <p style={{ fontSize: 11, opacity: 0.75, marginTop: 1 }}>📡 {nodeInfo.region}</p>
          )}
        </div>
        <button
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Settings"
          style={{ background: "none", border: "none", color: "#93c5fd", fontSize: 20, cursor: "pointer", padding: "0 4px" }}
        >⚙</button>
      </header>

      <main className="page">
        <div className="card" style={{ padding: "16px" }}>
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              fontSize: 18, color: "#9ca3af", pointerEvents: "none", lineHeight: 1,
            }}>&#128269;</span>
            <input
              id="search"
              type="search"
              placeholder="Search properties…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoFocus
              style={{
                paddingLeft: 44,
                paddingRight: loading ? 40 : 14,
                paddingTop: 14,
                paddingBottom: 14,
                fontSize: 17,
                border: "2px solid #d1d5db",
                borderRadius: 14,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            />
            {loading && (
              <span style={{
                position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                fontSize: 18, color: "#9ca3af", lineHeight: 1,
              }}>&#8987;</span>
            )}
          </div>
          {searchError && <p className="status-err">{searchError}</p>}

          {locations.length > 1 && (
            <div style={{ marginTop: 14 }}>
              <label htmlFor="loc-filter" style={{ marginTop: 0 }}>Filter by location</label>
              <select
                id="loc-filter"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                style={{ width: "100%", padding: "11px 13px", border: "1.5px solid #d1d5db", borderRadius: 10, background: "#f9fafb", color: "#111827", marginTop: 6, WebkitAppearance: "none" }}
              >
                <option value="">All locations ({results?.length})</option>
                {locations.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {gpsResolved && !loading && (
          <div style={{ marginTop: 12, padding: "8px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, fontSize: 12, color: "#1e40af" }}>
            📍 Results from <strong>{gpsResolved.region ?? searchNodeUrl}</strong>
          </div>
        )}

        {filtered !== null && (
          <div style={{ marginTop: 16 }}>
            {filtered.length === 0 && !loading ? (
              <div>
                <p style={{ textAlign: "center", color: "#9ca3af", padding: "20px 0 12px" }}>
                  No properties found for &ldquo;{query}&rdquo;.
                </p>
                {!showCreate ? (
                  <button
                    onClick={() => { setShowCreate(true); setCreateName(query); }}
                    style={{ width: "100%", padding: "12px", borderRadius: 10, border: "2px dashed #1e3a5f", background: "transparent", color: "#1e3a5f", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
                  >+ Add &ldquo;{query}&rdquo; to the database</button>
                ) : (
                  <div className="card" style={{ marginTop: 8 }}>
                    <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>New property</p>
                    <label htmlFor="create-name">Name</label>
                    <input id="create-name" type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Hotel Example" style={{ marginBottom: 10 }} />
                    <label htmlFor="create-location">Location</label>
                    <input id="create-location" type="text" value={createLocation} onChange={(e) => setCreateLocation(e.target.value)} placeholder="e.g. Main Street 1, Amsterdam" style={{ marginBottom: 10 }} />
                    {hasSavedToken && (
                      <p style={{ fontSize: 12, color: "#059669", marginBottom: 10 }}>Logged in — ready to create.</p>
                    )}
                    {!hasSavedToken && (
                      <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10 }}>Open any property first to log in.</p>
                    )}
                    {createError && <p className="status-err">{createError}</p>}
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button onClick={createProperty} disabled={createLoading} style={{ flex: 1, background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 10, padding: "10px", fontWeight: 700, cursor: "pointer" }}>
                        {createLoading ? "Creating…" : "Create & start audit"}
                      </button>
                      <button onClick={() => setShowCreate(false)} style={{ background: "transparent", border: "1px solid #d1d5db", borderRadius: 10, padding: "10px 14px", cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              filtered.map((p) => (
                <Link key={p.id} href={`/audit/${p.id}${searchNodeUrl !== nodeUrl ? `?node=${encodeURIComponent(searchNodeUrl)}` : ""}`} style={{ display: "block" }}>
                  <div className="card" style={{ marginTop: 12, cursor: "pointer" }}>
                    <p style={{ fontWeight: 600, fontSize: 16 }}>{p.name}</p>
                    <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>📍 {p.location}</p>
                    <p style={{ color: "#1e3a5f", fontSize: 13, marginTop: 8, fontWeight: 600 }}>Start audit →</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        <div style={{ marginTop: 32, padding: "12px 16px", background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
          <p style={{ fontSize: 12, color: nodeReachable === false ? "#ef4444" : nodeReachable ? "#059669" : "#9ca3af" }}>
            {nodeReachable === false ? "Not connected" : nodeReachable ? "Connected" : "Connecting\u2026"}
            {" \u00b7 "}<code style={{ fontSize: 11 }}>{nodeUrl}</code>
          </p>
          <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Tap the gear icon (top right) to change your home node.</p>
        </div>

        {recentAudits.length > 0 && !query && (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Recently audited</p>
            {recentAudits.map((p) => (
              <Link key={p.id} href={`/audit/${p.id}`} style={{ display: "block" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", marginBottom: 8,
                  background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
                  cursor: "pointer",
                }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>\ud83d\udcdd</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                    <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.location}</p>
                  </div>
                  <p style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>
                    {new Date(p.auditedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
