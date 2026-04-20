"use client";

import { useState } from "react";

export function AdminPanel() {
  const [restoreStatus, setRestoreStatus] = useState<null | { ok: boolean; message: string; warnings?: string[] }>(null);
  const [restoring, setRestoring] = useState(false);

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    setRestoreStatus(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const data = await res.json() as {
        ok?: boolean; message?: string;
        restored?: { properties: number; facts: number; audits: number; peers: number };
        warnings?: string[];
      };
      if (res.ok && data.ok) {
        const { properties, facts, audits, peers } = data.restored!;
        setRestoreStatus({
          ok: true,
          message: `Restored ${properties} properties, ${facts} facts, ${audits} audits, ${peers} peers.`,
          warnings: data.warnings,
        });
      } else {
        setRestoreStatus({ ok: false, message: data.message ?? "Restore failed" });
      }
    } catch (err) {
      setRestoreStatus({ ok: false, message: String(err) });
    } finally {
      setRestoring(false);
      e.target.value = "";
    }
  }

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "20px 24px", marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#111827" }}>Backup &amp; Restore</h3>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        Backup exports all properties, facts, audits and peers to a JSON file.
        Restore replaces all data — make a backup first.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {/* Backup */}
        <a
          href="/api/admin/backup"
          download
          style={{
            background: "#1e3a5f", color: "#fff", borderRadius: 8,
            padding: "9px 20px", fontSize: 13, fontWeight: 600,
            textDecoration: "none", display: "inline-block",
          }}
        >
          ⬇ Download Backup
        </a>

        {/* Restore */}
        <label style={{
          background: "#f3f4f6", color: "#374151", borderRadius: 8,
          padding: "9px 20px", fontSize: 13, fontWeight: 600,
          cursor: restoring ? "not-allowed" : "pointer", border: "1px solid #d1d5db",
          opacity: restoring ? 0.6 : 1,
        }}>
          {restoring ? "Restoring…" : "⬆ Restore from file"}
          <input
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            disabled={restoring}
            onChange={handleRestore}
          />
        </label>
      </div>

      {restoreStatus && (
        <div style={{
          marginTop: 16, padding: "12px 16px", borderRadius: 8,
          background: restoreStatus.ok ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${restoreStatus.ok ? "#bbf7d0" : "#fecaca"}`,
          fontSize: 13, color: restoreStatus.ok ? "#166534" : "#991b1b",
        }}>
          {restoreStatus.ok ? "✅ " : "❌ "}{restoreStatus.message}
          {restoreStatus.warnings && restoreStatus.warnings.length > 0 && (
            <ul style={{ marginTop: 8, paddingLeft: 20, color: "#92400e" }}>
              {restoreStatus.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
