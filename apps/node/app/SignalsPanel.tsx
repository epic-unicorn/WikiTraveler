"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@wikitraveler/ui";

type SignalRow = {
  id: string;
  type: string;
  status: string;
  fieldName: string | null;
  currentValue: string | null;
  currentTier: string | null;
  note: string | null;
  priorityScore: number;
  reporterId: string;
  createdAt: string;
  property: { id: string; name: string; location: string };
};

export function SignalsPanel({ token, showTitle = true }: { token: string; showTitle?: boolean }) {
  const { t, getFieldLabel } = useLocale();
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [filter, setFilter] = useState<"OPEN" | "IN_PROGRESS" | "all">("OPEN");

  function load() {
    setLoading(true);
    const q = filter === "all" ? "" : `?status=${filter}`;
    fetch(`/api/admin/signals${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { signals?: SignalRow[] }) => {
        setSignals(data.signals ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError(t("ui.signalsLoadFailed"));
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, [filter, token]);

  async function patchStatus(id: string, status: string, resolution?: string) {
    setSaving(id);
    try {
      const res = await fetch(`/api/admin/signals/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, resolution }),
      });
      if (!res.ok) {
        const data = await res.json() as { message?: string };
        setError(data.message ?? t("ui.signalsUpdateFailed"));
        return;
      }
      window.dispatchEvent(new Event("wt-signals-updated"));
      load();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div
      style={{
        background: "var(--wt-bg-elevated)",
        borderRadius: 12,
        border: "1px solid var(--wt-border)",
        padding: "20px 24px",
        marginBottom: showTitle ? 24 : 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: showTitle ? "space-between" : "flex-end", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        {showTitle && (
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t("ui.signalsPanelTitle")}</h3>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          {(["OPEN", "IN_PROGRESS", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid var(--wt-border)",
                background: filter === f ? "var(--wt-primary)" : "transparent",
                color: filter === f ? "var(--wt-primary-contrast)" : "var(--wt-text-muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {f === "all" ? t("ui.signalsFilterAll") : t(`ui.signalsStatus${f}`)}
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ color: "var(--wt-danger)", fontSize: 13 }}>{error}</p>}
      {loading && <p style={{ color: "var(--wt-text-muted)", fontSize: 13 }}>{t("ui.loading")}</p>}

      {!loading && signals.length === 0 && (
        <p style={{ color: "var(--wt-text-muted)", fontSize: 13 }}>{t("ui.signalsEmpty")}</p>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {signals.map((s) => (
          <div
            key={s.id}
            style={{
              border: "1px solid var(--wt-border)",
              borderRadius: 10,
              padding: "12px 14px",
              background: "var(--wt-bg)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div>
                <strong style={{ fontSize: 14 }}>{s.property.name}</strong>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--wt-text-muted)" }}>
                  {s.property.location}
                </p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--wt-primary)" }}>
                {t("ui.signalsPriority", { score: s.priorityScore })}
              </span>
            </div>
            <p style={{ fontSize: 12, margin: "8px 0 4px" }}>
              <strong>{t(`ui.signalType${s.type}`)}</strong>
              {s.fieldName ? ` · ${getFieldLabel(s.fieldName)}` : null}
              {s.currentTier ? ` · ${s.currentTier}` : null}
            </p>
            {s.note && (
              <p style={{ fontSize: 12, color: "var(--wt-text-muted)", margin: "0 0 8px" }}>{s.note}</p>
            )}
            <p style={{ fontSize: 11, color: "var(--wt-text-muted)", margin: "0 0 10px" }}>
              {s.reporterId} · {new Date(s.createdAt).toLocaleString()}
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Link
                href={`/properties/${s.property.id}?signal=${s.id}`}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--wt-primary)",
                  textDecoration: "none",
                }}
              >
                {t("ui.signalsStartAudit")}
              </Link>
              {s.status === "OPEN" && (
                <button
                  type="button"
                  disabled={saving === s.id}
                  onClick={() => patchStatus(s.id, "IN_PROGRESS")}
                  style={actionBtnStyle}
                >
                  {t("ui.signalsInProgress")}
                </button>
              )}
              <button
                type="button"
                disabled={saving === s.id}
                onClick={() => patchStatus(s.id, "RESOLVED", "addressed-by-audit")}
                style={actionBtnStyle}
              >
                {t("ui.signalsResolve")}
              </button>
              <button
                type="button"
                disabled={saving === s.id}
                onClick={() => patchStatus(s.id, "DISMISSED", "not-actionable")}
                style={actionBtnStyle}
              >
                {t("ui.signalsDismiss")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid var(--wt-border)",
  background: "transparent",
  cursor: "pointer",
  color: "var(--wt-text-muted)",
};
