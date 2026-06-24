"use client";

import { useState, useEffect, Fragment } from "react";
import { useLocale } from "@wikitraveler/ui";

type User = { id: string; username: string; role: string; createdAt: string };

const ROLES = ["USER", "AUDITOR", "ADMIN"] as const;

const ROLE_COLOR: Record<string, { bg: string; text: string }> = {
  USER:    { bg: "#f3f4f6", text: "#374151" },
  AUDITOR: { bg: "#dbeafe", text: "#1d4ed8" },
  ADMIN:   { bg: "#fee2e2", text: "#dc2626" },
};

export function UsersPanel({ token }: { token: string }) {
  const { t } = useLocale();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [passwordEdit, setPasswordEdit] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});
  const [openRegistration, setOpenRegistration] = useState(true);
  const [savingRegistration, setSavingRegistration] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/admin/settings", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([usersData, settingsData]: [{ users?: User[] }, { openRegistration?: boolean }]) => {
        const list = usersData.users ?? [];
        setUsers(list);
        const initial: Record<string, string> = {};
        list.forEach((u) => { initial[u.username] = u.role; });
        setPendingRoles(initial);
        if (typeof settingsData.openRegistration === "boolean") {
          setOpenRegistration(settingsData.openRegistration);
        }
        setLoading(false);
      })
      .catch(() => {
        setError(t("ui.adminLoadUsersFailed"));
        setLoading(false);
      });
  }, [token, t]);

  async function handleSaveRole(username: string) {
    const newRole = pendingRoles[username];
    setSaving(username);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setUsers((u) => u.map((x) => (x.username === username ? { ...x, role: newRole } : x)));
      }
    } finally {
      setSaving(null);
    }
  }

  function openPasswordEdit(username: string) {
    setPasswordEdit(username);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("");
  }

  function closePasswordEdit() {
    setPasswordEdit(null);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("");
  }

  async function handleSetPassword(username: string) {
    if (newPassword.length < 8) {
      setPasswordMessage(t("ui.adminPasswordMinLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage(t("ui.adminPasswordMismatch"));
      return;
    }

    setSaving(username);
    setPasswordMessage("");
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = (await res.json()) as { message?: string };
      if (res.ok) {
        closePasswordEdit();
      } else {
        setPasswordMessage(data.message ?? t("ui.adminSetPasswordFailed"));
      }
    } catch {
      setPasswordMessage(t("ui.adminSetPasswordFailed"));
    } finally {
      setSaving(null);
    }
  }

  async function handleToggleRegistration() {
    const next = !openRegistration;
    setSavingRegistration(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ openRegistration: next }),
      });
      if (res.ok) {
        const data = (await res.json()) as { openRegistration: boolean };
        setOpenRegistration(data.openRegistration);
      }
    } finally {
      setSavingRegistration(false);
    }
  }

  async function handleExportUsers() {
    const res = await fetch("/api/admin/users/export", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wikitraveler-users-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  }

  async function handleImportUsers(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: text,
      });
      const data = await res.json();
      if (res.ok) {
        const listRes = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
        const listData = (await listRes.json()) as { users?: User[] };
        setUsers(listData.users ?? []);
      } else {
        setError(data.message ?? t("ui.adminImportFailed"));
      }
    } catch {
      setError(t("ui.adminImportFailed"));
    }
    e.target.value = "";
  }

  async function handleDelete(username: string) {
    if (!confirm(t("ui.adminDeleteUserConfirm", { username }))) return;
    setSaving(username);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUsers((u) => u.filter((x) => x.username !== username));
        setPendingRoles((r) => {
          const next = { ...r };
          delete next[username];
          return next;
        });
      }
    } finally {
      setSaving(null);
    }
  }

  const cell: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #f3f4f6", fontSize: 13 };
  const th: React.CSSProperties = {
    ...cell, fontWeight: 600, color: "#6b7280", fontSize: 11,
    textTransform: "uppercase", letterSpacing: "0.05em", background: "#f9fafb",
  };

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "20px 24px", marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#111827" }}>{t("ui.adminUsersTitle")}</h3>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
        {t("ui.adminUsersLead")}
      </p>
      <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 16px", lineHeight: 1.5 }}>
        {t("ui.adminUsersExportNote")}
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, padding: "12px 14px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{t("ui.adminOpenRegistration")}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{t("ui.adminOpenRegistrationDesc")}</div>
        </div>
        <button
          type="button"
          onClick={() => void handleToggleRegistration()}
          disabled={savingRegistration}
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            border: "none",
            fontSize: 12,
            fontWeight: 700,
            cursor: savingRegistration ? "not-allowed" : "pointer",
            background: openRegistration ? "#dcfce7" : "#f3f4f6",
            color: openRegistration ? "#166534" : "#6b7280",
          }}
        >
          {savingRegistration ? "…" : openRegistration ? t("ui.adminRegistrationOpen") : t("ui.adminRegistrationClosed")}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void handleExportUsers()}
          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", fontSize: 13, cursor: "pointer" }}
        >
          {t("ui.adminExportUsers")}
        </button>
        <label style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", fontSize: 13, cursor: "pointer" }}>
          {t("ui.adminImportUsers")}
          <input type="file" accept="application/json" onChange={(e) => void handleImportUsers(e)} style={{ display: "none" }} />
        </label>
      </div>

      {loading && <p style={{ fontSize: 13, color: "#9ca3af" }}>{t("ui.adminLoadingUsers")}</p>}
      {error  && <p style={{ fontSize: 13, color: "#dc2626" }}>{error}</p>}

      {!loading && !error && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>{t("ui.adminUsername")}</th>
                <th style={{ ...th, textAlign: "left" }}>{t("ui.adminRole")}</th>
                <th style={{ ...th, textAlign: "left" }}>{t("ui.adminSince")}</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...cell, color: "#9ca3af", textAlign: "center" }}>
                    {t("ui.adminNoUsers")}
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const isSaving = saving === u.username;
                const currentRole = pendingRoles[u.username] ?? u.role;
                const roleChanged = currentRole !== u.role;
                const badge = ROLE_COLOR[u.role] ?? ROLE_COLOR.USER;
                const editingPassword = passwordEdit === u.username;

                return (
                  <Fragment key={u.id}>
                  <tr>
                    <td style={cell}>
                      <span style={{ fontWeight: 600 }}>{u.username}</span>
                    </td>
                    <td style={cell}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          display: "inline-block", borderRadius: 999, padding: "2px 8px",
                          fontSize: 11, fontWeight: 700,
                          background: badge.bg, color: badge.text,
                        }}>
                          {u.role}
                        </span>
                        <select
                          value={currentRole}
                          disabled={isSaving}
                          onChange={(e) =>
                            setPendingRoles((r) => ({ ...r, [u.username]: e.target.value }))
                          }
                          style={{
                            fontSize: 12, padding: "3px 6px", border: "1px solid #d1d5db",
                            borderRadius: 6, background: "#fff", cursor: "pointer",
                          }}
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {roleChanged && (
                          <button
                            onClick={() => handleSaveRole(u.username)}
                            disabled={isSaving}
                            style={{
                              fontSize: 11, padding: "3px 10px", border: "none",
                              borderRadius: 6, background: "#1e3a5f", color: "#fff",
                              cursor: isSaving ? "not-allowed" : "pointer", fontWeight: 600,
                            }}
                          >
                            {isSaving ? t("ui.adminSaving") : t("ui.adminSave")}
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ ...cell, color: "#9ca3af" }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ ...cell, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => editingPassword ? closePasswordEdit() : openPasswordEdit(u.username)}
                          disabled={isSaving}
                          style={{
                            fontSize: 11, padding: "3px 10px",
                            border: "1px solid #d1d5db", borderRadius: 6,
                            background: editingPassword ? "#eff6ff" : "#fff", color: "#1e3a5f",
                            cursor: isSaving ? "not-allowed" : "pointer",
                          }}
                        >
                          {editingPassword ? t("ui.adminCancel") : t("ui.adminSetPassword")}
                        </button>
                        <button
                          onClick={() => handleDelete(u.username)}
                          disabled={isSaving}
                          style={{
                            fontSize: 11, padding: "3px 10px",
                            border: "1px solid #fecaca", borderRadius: 6,
                            background: "#fff", color: "#dc2626",
                            cursor: isSaving ? "not-allowed" : "pointer",
                          }}
                        >
                          {isSaving ? "…" : t("ui.adminDelete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingPassword && (
                    <tr>
                      <td colSpan={4} style={{ ...cell, background: "#f9fafb" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                            {t("ui.adminNewPassword")}
                            <input
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              autoComplete="new-password"
                              style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                            />
                          </label>
                          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                            {t("ui.adminConfirmPassword")}
                            <input
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              autoComplete="new-password"
                              style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => void handleSetPassword(u.username)}
                            disabled={isSaving}
                            style={{
                              fontSize: 12, padding: "6px 12px", border: "none", borderRadius: 6,
                              background: "#1e3a5f", color: "#fff", fontWeight: 600,
                              cursor: isSaving ? "not-allowed" : "pointer",
                            }}
                          >
                            {isSaving ? t("ui.adminSaving") : t("ui.adminSavePassword")}
                          </button>
                          {passwordMessage && (
                            <span style={{ fontSize: 12, color: "#dc2626", alignSelf: "center" }}>{passwordMessage}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
