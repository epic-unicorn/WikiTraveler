"use client";

import { useState, useEffect, useCallback } from "react";

type Peer = {
  id: string;
  url: string;
  nodeId: string | null;
  region: string | null;
  bbox: string | null;
  lastSeen: string;
  isActive: boolean;
};

const cell: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--wt-border)",
  fontSize: 13,
  color: "var(--wt-text)",
};
const th: React.CSSProperties = {
  ...cell,
  fontWeight: 600,
  color: "var(--wt-text-muted)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  background: "var(--wt-bg-secondary)",
};

export function PeersPanel({ token }: { token: string }) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/nodes", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: { peers?: Peer[] }) => {
        setPeers(d.peers ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load peers");
        setLoading(false);
      });
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    const url = addUrl.trim().replace(/\/$/, "");
    if (!url) return;
    setAdding(true);
    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });
      const data = await res.json() as { peer?: Peer; message?: string };
      if (!res.ok) {
        setAddError(data.message ?? "Failed to add peer");
        return;
      }
      setAddUrl("");
      load();
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(url: string) {
    if (!confirm(`Remove peer "${url}"?\n\nThe node will stop syncing with it. You can re-add it at any time.`)) return;
    setRemoving(url);
    try {
      await fetch(`/api/nodes?url=${encodeURIComponent(url)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setPeers((p) => p.filter((x) => x.url !== url));
    } finally {
      setRemoving(null);
    }
  }

  async function handleRefreshAll() {
    setRefreshing(true);
    setRefreshMsg("");
    try {
      const res = await fetch("/api/nodes/refresh", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { updated?: number; failed?: number; total?: number };
      setRefreshMsg(
        `Refreshed ${data.updated ?? 0} / ${data.total ?? 0} peers${
          (data.failed ?? 0) > 0 ? ` · ${data.failed} unreachable` : ""
        }.`
      );
      load();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--wt-bg-elevated)",
        borderRadius: 12,
        border: "1px solid var(--wt-border)",
        padding: "20px 24px",
        marginBottom: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 4,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Peer Nodes</h3>
          <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginTop: 4, marginBottom: 0 }}>
            Nodes this instance syncs accessibility facts with via gossip.
          </p>
        </div>
        <button
          onClick={handleRefreshAll}
          disabled={refreshing || loading || peers.length === 0}
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 14px",
            borderRadius: 8,
            border: "1px solid var(--wt-border)",
            background: "var(--wt-bg)",
            color: "var(--wt-text-muted)",
            cursor: refreshing || peers.length === 0 ? "not-allowed" : "pointer",
            opacity: refreshing || peers.length === 0 ? 0.5 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {refreshing ? "Refreshing…" : "Refresh all"}
        </button>
      </div>

      {refreshMsg && (
        <p style={{ fontSize: 12, color: "var(--wt-text-muted)", marginBottom: 12, marginTop: 8 }}>
          {refreshMsg}
        </p>
      )}

      {/* Table */}
      {loading && (
        <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginTop: 16 }}>
          Loading peers…
        </p>
      )}
      {error && (
        <p style={{ fontSize: 13, color: "var(--wt-danger)", marginTop: 16 }}>{error}</p>
      )}

      {!loading && !error && (
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>URL</th>
                <th style={{ ...th, textAlign: "left" }}>Region</th>
                <th style={{ ...th, textAlign: "right" }}>Last seen</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {peers.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{ ...cell, color: "var(--wt-text-muted)", textAlign: "center", padding: "20px 12px" }}
                  >
                    No peer nodes yet. Add one below.
                  </td>
                </tr>
              )}
              {peers.map((p) => {
                const isBusy = removing === p.url;
                const ago = formatAgo(p.lastSeen);
                return (
                  <tr key={p.url}>
                    <td style={{ ...cell, fontFamily: "var(--wt-font-mono)", fontSize: 12 }}>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--wt-primary)" }}
                      >
                        {p.url}
                      </a>
                      {p.nodeId && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            color: "var(--wt-text-muted)",
                            fontFamily: "inherit",
                          }}
                        >
                          {p.nodeId}
                        </span>
                      )}
                    </td>
                    <td style={{ ...cell, color: "var(--wt-text-muted)" }}>
                      {p.region ?? "—"}
                    </td>
                    <td style={{ ...cell, textAlign: "right", color: "var(--wt-text-muted)", whiteSpace: "nowrap" }}>
                      {ago}
                    </td>
                    <td style={{ ...cell, textAlign: "right" }}>
                      <button
                        onClick={() => handleRemove(p.url)}
                        disabled={isBusy}
                        style={{
                          fontSize: 11,
                          padding: "3px 10px",
                          border: "1px solid var(--wt-border)",
                          borderRadius: 6,
                          background: "var(--wt-bg)",
                          color: "var(--wt-danger)",
                          cursor: isBusy ? "not-allowed" : "pointer",
                        }}
                      >
                        {isBusy ? "…" : "Remove"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add peer form */}
      <form
        onSubmit={handleAdd}
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: "1px solid var(--wt-border)",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <input
            type="url"
            value={addUrl}
            onChange={(e) => { setAddUrl(e.target.value); setAddError(""); }}
            placeholder="https://other-node.example.com"
            required
            disabled={adding}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "9px 12px",
              border: `1.5px solid ${addError ? "var(--wt-danger)" : "var(--wt-border)"}`,
              borderRadius: 8,
              fontSize: 13,
              background: "var(--wt-bg)",
              color: "var(--wt-text)",
              outline: "none",
              fontFamily: "var(--wt-font-mono)",
            }}
          />
          {addError && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--wt-danger)" }}>
              {addError}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={adding || !addUrl.trim()}
          style={{
            padding: "9px 18px",
            borderRadius: 8,
            border: "none",
            background: "var(--wt-primary)",
            color: "var(--wt-primary-contrast)",
            fontSize: 13,
            fontWeight: 600,
            cursor: adding || !addUrl.trim() ? "not-allowed" : "pointer",
            opacity: adding || !addUrl.trim() ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {adding ? "Connecting…" : "Add peer"}
        </button>
      </form>
    </div>
  );
}

function formatAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
