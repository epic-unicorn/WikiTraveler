"use client";

import { useState } from "react";
import { useLocale } from "@wikitraveler/ui";

interface Props {
  token: string;
}

export function AdminPanel({ token }: Props) {
  const { t } = useLocale();
  const [restoreStatus, setRestoreStatus] = useState<null | { ok: boolean; message: string; warnings?: string[] }>(null);
  const [restoring, setRestoring] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleBackup() {
    setDownloading(true);
    try {
      const res = await fetch("/api/admin/backup", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json() as { message?: string };
        alert(data.message ?? t("ui.adminBackupFailed"));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wikitraveler-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
    } finally {
      setDownloading(false);
    }
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    setRestoreStatus(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
          message: t("ui.adminRestoreSuccess", { properties, facts, audits, peers }),
          warnings: data.warnings,
        });
      } else {
        setRestoreStatus({ ok: false, message: data.message ?? t("ui.adminRestoreFailed") });
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
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#111827" }}>{t("ui.adminBackupTitle")}</h3>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
        {t("ui.adminBackupLead")}{" "}
        <strong style={{ color: "#374151" }}>{t("ui.adminBackupRestoreWipes")}</strong>{" "}
        {t("ui.adminBackupRestoreSuffix")}
      </p>
      <ul style={{ fontSize: 12, color: "#6b7280", margin: "0 0 16px", paddingLeft: 18, lineHeight: 1.5 }}>
        <li><strong style={{ color: "#374151" }}>{t("ui.adminBackupUseFor")}</strong> {t("ui.adminBackupUseForDesc")}</li>
        <li><strong style={{ color: "#374151" }}>{t("ui.adminBackupNotFor")}</strong> {t("ui.adminBackupNotForDesc")}</li>
        <li><strong style={{ color: "#374151" }}>{t("ui.adminBackupExcludes")}</strong> {t("ui.adminBackupExcludesDesc")}</li>
      </ul>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={handleBackup}
          disabled={downloading}
          style={{
            background: "#1e3a5f", color: "#fff", borderRadius: 8,
            padding: "9px 20px", fontSize: 13, fontWeight: 600,
            border: "none", cursor: downloading ? "not-allowed" : "pointer",
            opacity: downloading ? 0.7 : 1,
          }}
        >
          {downloading ? t("ui.adminBackupPreparing") : t("ui.adminDownloadBackup")}
        </button>

        <label style={{
          background: "#f3f4f6", color: "#374151", borderRadius: 8,
          padding: "9px 20px", fontSize: 13, fontWeight: 600,
          cursor: restoring ? "not-allowed" : "pointer", border: "1px solid #d1d5db",
          opacity: restoring ? 0.6 : 1,
        }}>
          {restoring ? t("ui.adminRestoring") : t("ui.adminRestoreFromFile")}
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
