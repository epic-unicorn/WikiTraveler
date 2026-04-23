"use client";

import { useState, useEffect } from "react";

type User = { id: string; username: string; role: string; createdAt: string };

const ROLES = ["USER", "AUDITOR", "ADMIN"] as const;

const ROLE_COLOR: Record<string, { bg: string; text: string }> = {
  USER:    { bg: "#f3f4f6", text: "#374151" },
  AUDITOR: { bg: "#dbeafe", text: "#1d4ed8" },
  ADMIN:   { bg: "#fee2e2", text: "#dc2626" },
};

export function UsersPanel({ token }: { token: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: { users?: User[] }) => {
        const list = d.users ?? [];
        setUsers(list);
        const initial: Record<string, string> = {};
        list.forEach((u) => { initial[u.username] = u.role; });
        setPendingRoles(initial);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load users");
        setLoading(false);
      });
  }, [token]);

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
        setUsers((u) => u.map((x) => x.username === username ? { ...x, role: newRole } : x));
      }
    } finally {
      setSaving(null);
    }
  }

  async function handleDelete(username: string) {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
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
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#111827" }}>Users</h3>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
        Manage user accounts and roles. Changes take effect immediately.
      </p>

      {loading && <p style={{ fontSize: 13, color: "#9ca3af" }}>Loading users…</p>}
      {error  && <p style={{ fontSize: 13, color: "#dc2626" }}>{error}</p>}

      {!loading && !error && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Username</th>
                <th style={{ ...th, textAlign: "left" }}>Role</th>
                <th style={{ ...th, textAlign: "left" }}>Since</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...cell, color: "#9ca3af", textAlign: "center" }}>
                    No users found.
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const isSaving = saving === u.username;
                const currentRole = pendingRoles[u.username] ?? u.role;
                const roleChanged = currentRole !== u.role;
                const badge = ROLE_COLOR[u.role] ?? ROLE_COLOR.USER;

                return (
                  <tr key={u.id}>
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
                            {isSaving ? "Saving…" : "Save"}
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ ...cell, color: "#9ca3af" }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ ...cell, textAlign: "right" }}>
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
                        {isSaving ? "…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
