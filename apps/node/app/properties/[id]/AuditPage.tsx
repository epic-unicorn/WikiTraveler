"use client";

import { useState, useEffect } from "react";

const TIER_LABEL: Record<string, string> = {
  OFFICIAL: "Official",
  AI_GUESS: "AI Estimate",
  VERIFIED: "Verified",
  CONFIRMED: "Confirmed",
};

const TIER_BADGE_CLASS: Record<string, string> = {
  OFFICIAL: "wt-fact-badge--official",
  AI_GUESS: "wt-fact-badge--ai_guess",
  VERIFIED: "wt-fact-badge--verified",
  CONFIRMED: "wt-fact-badge--confirmed",
};

const SOURCE_LABEL: Record<string, string> = {
  AMADEUS: "Amadeus",
  WHEELMAP: "Wheelmap ♿",
  OSM: "OpenStreetMap",
  WHEEL_THE_WORLD: "WtW",
  AUDITOR: "Field Audit",
};

const FIELD_LABELS: Record<string, string> = {
  door_width_cm: "Door Width (cm)",
  ramp_present: "Ramp Present",
  elevator_present: "Elevator",
  elevator_floor_count: "Elevator Floors",
  quiet_hours_start: "Quiet Hours Start",
  quiet_hours_end: "Quiet Hours End",
  accessible_bathroom: "Accessible Bathroom",
  hearing_loop: "Hearing Loop",
  braille_signage: "Braille Signage",
  step_free_entrance: "Step-Free Entrance",
  parking_accessible: "Accessible Parking",
  notes: "Notes",
};

function formatFactValue(fieldName: string, value: string): string {
  if (fieldName === "notes") return value;
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return value;
}

interface Fact {
  fieldName: string;
  value: string;
  tier: string;
  sourceType: string;
  submittedBy: string | null;
  timestamp: string;
}

interface Props {
  propertyId: string;
  propertyName: string;
  initialFacts: Fact[];
}

export default function AuditPage({ propertyId, initialFacts }: Props) {
  const [facts, setFacts] = useState<Fact[]>(initialFacts);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [auditRows, setAuditRows] = useState<Array<{ fieldName: string; value: string }>>([
    { fieldName: "door_width_cm", value: "" },
  ]);
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "ok" | "error"; msg?: string }>({ type: "idle" });

  // Seed token from cookie so a logged-in admin/auditor doesn't need to re-authenticate
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)wt_token=([^;]+)/);
    if (m) setToken(decodeURIComponent(m[1]));
  }, []);

  async function getToken() {
    setStatus({ type: "loading" });
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json() as { token?: string; message?: string };
    if (!res.ok) {
      setStatus({ type: "error", msg: data.message ?? "Auth failed" });
      return;
    }
    setToken(data.token ?? null);
    setStatus({ type: "idle" });
  }

  function addRow() {
    setAuditRows((r) => [...r, { fieldName: "notes", value: "" }]);
  }

  function removeRow(i: number) {
    setAuditRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function submitAudit() {
    if (!token) return;
    const valid = auditRows.filter((r) => r.fieldName && r.value.trim());
    if (valid.length === 0) {
      setStatus({ type: "error", msg: "Add at least one fact before submitting." });
      return;
    }
    setStatus({ type: "loading" });
    const res = await fetch(`/api/properties/${propertyId}/accessibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ facts: valid }),
    });
    const data = await res.json() as { message?: string };
    if (!res.ok) {
      setStatus({ type: "error", msg: data.message ?? "Submit failed" });
      return;
    }

    // Refresh facts
    const refreshed = await fetch(`/api/properties/${propertyId}/accessibility`);
    const refreshedData = await refreshed.json() as { facts: Fact[] };
    setFacts(refreshedData.facts ?? []);
    setStatus({ type: "ok", msg: "Audit submitted! Facts updated." });
    setAuditRows([{ fieldName: "door_width_cm", value: "" }]);
  }

  return (
    <div>
      <p style={{ color: "var(--wt-text-muted)", fontSize: 14, marginBottom: 32 }}>
        Property ID: <code>{propertyId}</code>
      </p>

      {/* Current facts */}
      <section style={{ marginBottom: 40 }} aria-labelledby="facts-heading">
        <h2 id="facts-heading" style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>Current Accessibility Facts</h2>
        {facts.length === 0 ? (
          <p style={{ color: "var(--wt-text-muted)" }}>No facts yet — submit an audit below.</p>
        ) : (
          <ul className="wt-facts-list" role="list">
            {facts.map((f) => (
              <li key={f.fieldName} className="wt-fact-row">
                <div className="wt-fact-row-main">
                  <span className="wt-fact-label">{FIELD_LABELS[f.fieldName] ?? f.fieldName}</span>
                  <span className="wt-fact-value">{formatFactValue(f.fieldName, f.value)}</span>
                </div>
                <div className="wt-fact-row-meta">
                  <span className={`wt-fact-badge ${TIER_BADGE_CLASS[f.tier] ?? "wt-fact-badge--official"}`}>
                    {TIER_LABEL[f.tier] ?? f.tier}
                  </span>
                  <span className="wt-fact-badge wt-fact-badge--source">
                    {SOURCE_LABEL[f.sourceType] ?? f.sourceType}
                  </span>
                  <time className="wt-fact-when" dateTime={f.timestamp}>
                    {new Date(f.timestamp).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Auth */}
      {!token && (
        <section
          style={{
            background: "var(--wt-bg-elevated)", border: "1px solid var(--wt-border)",
            borderRadius: 12, padding: 24, marginBottom: 24,
          }}
          aria-labelledby="auth-heading"
        >
          <h2 id="auth-heading" style={{ fontSize: 17, fontWeight: 600, marginBottom: 12 }}>Authenticate</h2>
          <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginBottom: 16 }}>
            Sign in with your node account to submit a field audit.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
            <label htmlFor="audit-auth-username" className="wt-sr-only">Username</label>
            <input
              id="audit-auth-username"
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              style={{ padding: "8px 12px", border: "1px solid var(--wt-border)", borderRadius: 8, fontSize: 14 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <label htmlFor="audit-auth-password" className="wt-sr-only">Password</label>
              <input
                id="audit-auth-password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && getToken()}
                autoComplete="current-password"
                style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--wt-border)", borderRadius: 8, fontSize: 14 }}
              />
              <button
                type="button"
                onClick={getToken}
                disabled={status.type === "loading"}
                style={{ background: "var(--wt-bg-header)", color: "var(--wt-bg-header-contrast)", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontWeight: 600 }}
              >
                Sign in
              </button>
            </div>
          </div>
          {status.type === "error" && <p role="alert" style={{ color: "var(--wt-danger)", fontSize: 13, marginTop: 8 }}>{status.msg}</p>}
        </section>
      )}

      {/* Submit audit */}
      {token && (
        <section
          style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: 12, padding: 24,
          }}
        >
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Submit Field Audit</h2>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
            Your submission will be recorded as <strong style={{ color: "#34d399" }}>Verified</strong>.
          </p>

          {auditRows.map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <label htmlFor={`audit-field-${i}`} className="wt-sr-only">Field {i + 1}</label>
              <select
                id={`audit-field-${i}`}
                value={row.fieldName}
                aria-label={`Field name row ${i + 1}`}
                onChange={(e) =>
                  setAuditRows((rows) =>
                    rows.map((r, idx) => idx === i ? { ...r, fieldName: e.target.value } : r)
                  )
                }
                style={{ flex: 1, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}
              >
                {Object.entries(FIELD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <label htmlFor={`audit-value-${i}`} className="wt-sr-only">Value {i + 1}</label>
              <input
                id={`audit-value-${i}`}
                placeholder="Value"
                aria-label={`Field value row ${i + 1}`}
                value={row.value}
                onChange={(e) =>
                  setAuditRows((rows) =>
                    rows.map((r, idx) => idx === i ? { ...r, value: e.target.value } : r)
                  )
                }
                style={{ flex: 1, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}
              />
              <button
                type="button"
                aria-label={`Remove row ${i + 1}`}
                onClick={() => removeRow(i)}
                style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", minWidth: 44, minHeight: 44 }}
              >×</button>
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              onClick={addRow}
              style={{ background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}
            >+ Add Field</button>
            <button
              onClick={submitAudit}
              disabled={status.type === "loading"}
              style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
            >Submit Audit</button>
          </div>

          {status.type === "ok" && (
            <p role="status" style={{ color: "#059669", fontSize: 13, marginTop: 12 }}>{status.msg}</p>
          )}
          {status.type === "error" && (
            <p role="alert" style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>{status.msg}</p>
          )}
        </section>
      )}
    </div>
  );
}
