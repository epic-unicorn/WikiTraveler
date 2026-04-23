"use client";

import { useState } from "react";

const TIER_COLOR: Record<string, string> = {
  OFFICIAL: "#9ca3af",
  AI_GUESS: "#fbbf24",
  VERIFIED: "#34d399",
  CONFIRMED: "#60a5fa",
};

const TIER_LABEL: Record<string, string> = {
  OFFICIAL: "Official",
  AI_GUESS: "AI Estimate",
  VERIFIED: "Verified",
  CONFIRMED: "Confirmed",
};

const SOURCE_COLOR: Record<string, string> = {
  AMADEUS: "#6366f1",
  WHEELMAP: "#0ea5e9",
  OSM: "#16a34a",
  WHEEL_THE_WORLD: "#f97316",
  AUDITOR: "#10b981",
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

export default function AuditPage({ propertyId, propertyName, initialFacts }: Props) {
  const [facts, setFacts] = useState<Fact[]>(initialFacts);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [auditRows, setAuditRows] = useState<Array<{ fieldName: string; value: string }>>([
    { fieldName: "door_width_cm", value: "" },
  ]);
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "ok" | "error"; msg?: string }>({ type: "idle" });

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
    <div style={{ maxWidth: 760, margin: "32px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{propertyName}</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 32 }}>
        Property ID: <code>{propertyId}</code>
      </p>

      {/* Current facts */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>Current Accessibility Facts</h2>
        {facts.length === 0 ? (
          <p style={{ color: "#9ca3af" }}>No facts yet — submit an audit below.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                {["Feature", "Value", "Trust", "Source", "When"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facts.map((f, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 500 }}>{FIELD_LABELS[f.fieldName] ?? f.fieldName}</td>
                  <td style={{ padding: "10px 12px" }}>{f.value}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ background: TIER_COLOR[f.tier] ?? "#9ca3af", color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                      {TIER_LABEL[f.tier] ?? f.tier}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ background: SOURCE_COLOR[f.sourceType] ?? "#9ca3af", color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                      {SOURCE_LABEL[f.sourceType] ?? f.sourceType}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#9ca3af", fontSize: 12 }}>
                    {new Date(f.timestamp).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Auth */}
      {!token && (
        <section
          style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: 12, padding: 24, marginBottom: 24,
          }}
        >
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12 }}>Authenticate</h2>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
            Sign in with your node account to submit a field audit.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && getToken()}
                style={{ flex: 1, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14 }}
              />
              <button
                onClick={getToken}
                disabled={status.type === "loading"}
                style={{ background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontWeight: 600 }}
              >
                Sign in
              </button>
            </div>
          </div>
          {status.type === "error" && <p style={{ color: "#ef4444", fontSize: 13, marginTop: 8 }}>{status.msg}</p>}
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
              <select
                value={row.fieldName}
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
              <input
                placeholder="Value"
                value={row.value}
                onChange={(e) =>
                  setAuditRows((rows) =>
                    rows.map((r, idx) => idx === i ? { ...r, value: e.target.value } : r)
                  )
                }
                style={{ flex: 1, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}
              />
              <button
                onClick={() => removeRow(i)}
                style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}
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

          {status.type === "ok" && <p style={{ color: "#059669", fontSize: 13, marginTop: 12 }}>✅ {status.msg}</p>}
          {status.type === "error" && <p style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>⚠️ {status.msg}</p>}
        </section>
      )}
    </div>
  );
}
