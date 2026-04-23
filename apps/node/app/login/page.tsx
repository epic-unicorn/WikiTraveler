"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AccessDenied({ username, onBack }: { username: string; onBack: () => void }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#f9fafb",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
        padding: "36px 32px", width: "100%", maxWidth: 380,
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)", textAlign: "center",
      }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>🔒</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
          No dashboard access
        </h2>
        <div style={{
          background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12,
          padding: "14px 16px", marginBottom: 20, textAlign: "left",
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#991b1b", marginBottom: 6 }}>
            Auditor or Admin role required
          </p>
          <p style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.5 }}>
            The node dashboard is only accessible to Auditors and Admins.
            Your account <strong>{username}</strong> has the USER role.
            Contact an admin to request access.
          </p>
        </div>
        <button
          onClick={onBack}
          style={{
            width: "100%", background: "#6b7280", color: "#fff", border: "none",
            borderRadius: 10, padding: "12px", fontSize: 15, fontWeight: 600, cursor: "pointer",
          }}
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deniedUsername, setDeniedUsername] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json() as { token?: string; message?: string; username?: string; role?: string };
      if (!res.ok) {
        setError(data.message ?? "Login failed");
        return;
      }
      const role = (data.role ?? "USER").toUpperCase();
      if (role === "USER") {
        setDeniedUsername(data.username ?? username);
        return;
      }
      const maxAge = 30 * 24 * 60 * 60;
      document.cookie = `wt_token=${encodeURIComponent(data.token!)}; path=/; max-age=${maxAge}; SameSite=Lax`;
      sessionStorage.setItem("wt_node_token", data.token!);
      router.replace(searchParams.get("next") ?? "/");
    } catch {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  }

  if (deniedUsername) {
    return <AccessDenied username={deniedUsername} onBack={() => setDeniedUsername("")} />;
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "11px 13px",
    border: "1.5px solid #d1d5db", borderRadius: 10, fontSize: 15,
    outline: "none", fontFamily: "inherit", background: "#f9fafb",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#f9fafb",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
        padding: "36px 32px", width: "100%", maxWidth: 380,
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🌍</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>WikiTraveler Node</h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your username"
            required
            autoComplete="username"
            autoFocus
            style={{ ...inputStyle, marginBottom: 12 }}
          />

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            style={{ ...inputStyle, marginBottom: 20 }}
          />

          {error && (
            <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", background: "#1e3a5f", color: "#fff", border: "none",
              borderRadius: 10, padding: "12px", fontSize: 15, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
