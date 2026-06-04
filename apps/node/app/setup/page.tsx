"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 13px",
  border: "1.5px solid #d1d5db",
  borderRadius: 10,
  fontSize: 15,
  outline: "none",
  fontFamily: "inherit",
  background: "#f9fafb",
};

export default function SetupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as {
        token?: string;
        username?: string;
        message?: string;
      };

      if (!res.ok) {
        setError(data.message ?? "Setup failed.");
        return;
      }

      // Store the token and go straight to the dashboard
      const maxAge = 30 * 24 * 60 * 60;
      document.cookie = `wt_token=${encodeURIComponent(data.token!)}; path=/; max-age=${maxAge}; SameSite=Lax`;
      sessionStorage.setItem("wt_node_token", data.token!);
      router.replace("/");
    } catch {
      setError("Could not reach server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f0f7ff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          padding: "40px 36px",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 4px 32px rgba(0,0,0,0.08)",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🌍</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>
            WikiTraveler Node Setup
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 8, lineHeight: 1.5 }}>
            No admin account exists yet.
            <br />
            Create one to unlock the dashboard.
          </p>
        </div>

        {/* Info banner */}
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 24,
          }}
        >
          <p style={{ fontSize: 13, color: "#1e40af", margin: 0, lineHeight: 1.6 }}>
            This page is only accessible once. After the admin account is created
            it will be permanently disabled.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 5,
            }}
          >
            Admin username
          </label>
          <input
            style={{ ...inputStyle, marginBottom: 16 }}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            autoComplete="username"
            required
            minLength={3}
          />

          {/* Password */}
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 5,
            }}
          >
            Password
          </label>
          <input
            style={{ ...inputStyle, marginBottom: 16 }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
            minLength={8}
          />

          {/* Confirm password */}
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 5,
            }}
          >
            Confirm password
          </label>
          <input
            style={{ ...inputStyle, marginBottom: 24 }}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
            autoComplete="new-password"
            required
            minLength={8}
          />

          {/* Error */}
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "10px 12px",
                marginBottom: 16,
                fontSize: 13,
                color: "#b91c1c",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: loading ? "#9ca3af" : "#1e3a5f",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "13px",
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Creating account…" : "Create admin account"}
          </button>
        </form>
      </div>
    </div>
  );
}
