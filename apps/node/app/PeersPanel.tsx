"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@wikitraveler/ui";

type Peer = {
  id: string;
  url: string;
  nodeId: string | null;
  region: string | null;
  bbox: string | null;
  lastKnownVersion: string | null;
  gossipProtocol: number | null;
  lastSeen: string;
  isActive: boolean;
  skewLevel?: "ok" | "warn" | "error";
  skewMessage?: string | null;
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
  const { t } = useLocale();
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
        setError(t("ui.adminLoadPeersFailed"));
        setLoading(false);
      });
  }, [token, t]);

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
        setAddError(data.message ?? t("ui.adminAddPeerFailed"));
        return;
      }
      setAddUrl("");
      load();
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(url: string) {
    if (!confirm(t("ui.adminRemovePeerConfirm", { url }))) return;
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
      const updated = data.updated ?? 0;
      const total = data.total ?? 0;
      const failed = data.failed ?? 0;
      setRefreshMsg(
        t("ui.adminPeersRefreshed", { updated, total })
        + (failed > 0 ? t("ui.adminPeersUnreachable", { failed }) : "")
      );
      load();
    } finally {
      setRefreshing(false);
    }
  }

  const skewCount = peers.filter((p) => p.skewLevel === "warn" || p.skewLevel === "error").length;

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
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{t("ui.adminPeersTitle")}</h3>
          <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginTop: 4, marginBottom: 0 }}>
            {t("ui.adminPeersLead")}
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
          {refreshing ? t("ui.adminRefreshing") : t("ui.adminRefreshAll")}
        </button>
      </div>

      {skewCount > 0 && (
        <p
          style={{
            fontSize: 12,
            color: "var(--wt-warning, #b45309)",
            marginBottom: 12,
            marginTop: 8,
          }}
        >
          {skewCount} peer{skewCount === 1 ? "" : "s"} with version or protocol skew — refresh peers after upgrades.
        </p>
      )}

      {refreshMsg && (
        <p style={{ fontSize: 12, color: "var(--wt-text-muted)", marginBottom: 12, marginTop: 8 }}>
          {refreshMsg}
        </p>
      )}

      {loading && (
        <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginTop: 16 }}>
          {t("ui.adminLoadingPeers")}
        </p>
      )}
      {error && (
        <p style={{ fontSize: 13, color: "var(--wt-danger)", marginTop: 16 }}>{error}</p>
      )}

      {!loading && !error && (
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>{t("ui.adminUrl")}</th>
                <th style={{ ...th, textAlign: "left" }}>{t("ui.adminVersionCol")}</th>
                <th style={{ ...th, textAlign: "left" }}>{t("ui.adminRegionCol")}</th>
                <th style={{ ...th, textAlign: "right" }}>{t("ui.adminLastSeen")}</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {peers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{ ...cell, color: "var(--wt-text-muted)", textAlign: "center", padding: "20px 12px" }}
                  >
                    {t("ui.adminNoPeers")}
                  </td>
                </tr>
              )}
              {peers.map((p) => {
                const isBusy = removing === p.url;
                const ago = formatAgo(p.lastSeen, t);
                const skew = p.skewLevel ?? "ok";
                return (
                  <tr key={p.url}>
                    <td style={cell}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "var(--wt-primary)",
                            fontFamily: "var(--wt-font-mono)",
                            fontSize: 12,
                            wordBreak: "break-all",
                          }}
                        >
                          {p.url}
                        </a>
                        {p.nodeId && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: "var(--wt-text-muted)",
                              background: "var(--wt-bg-secondary)",
                              border: "1px solid var(--wt-border)",
                              borderRadius: 999,
                              padding: "2px 8px",
                              fontFamily: "var(--wt-font-mono)",
                            }}
                          >
                            {p.nodeId}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={cell}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontFamily: "var(--wt-font-mono)", fontSize: 12 }}>
                          {p.lastKnownVersion ?? "—"}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--wt-text-muted)" }}>
                          {t("ui.adminGossipProtocolCol")} {p.gossipProtocol ?? "—"}
                        </span>
                        {skew !== "ok" && p.skewMessage && (
                          <span
                            title={p.skewMessage}
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: skew === "error" ? "var(--wt-danger)" : "var(--wt-warning, #b45309)",
                            }}
                          >
                            {skew === "error" ? t("ui.adminPeerSkewError") : t("ui.adminPeerSkewWarn")}
                            {": "}
                            {p.skewMessage}
                          </span>
                        )}
                      </div>
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
                        {isBusy ? "…" : t("ui.adminRemove")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
            placeholder={t("ui.adminPeerUrlPlaceholder")}
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
          {adding ? t("ui.adminConnecting") : t("ui.adminAddPeer")}
        </button>
      </form>
    </div>
  );
}

function formatAgo(
  isoString: string,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return t("ui.adminJustNow");
  if (mins < 60) return t("ui.adminMinutesAgo", { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("ui.adminHoursAgo", { hrs });
  const days = Math.floor(hrs / 24);
  return t("ui.adminDaysAgo", { days });
}
