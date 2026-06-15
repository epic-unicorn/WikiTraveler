"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard, AuthCardLayout } from "../AuthCardLayout";

function AccessDenied({ username, onBack }: { username: string; onBack: () => void }) {
  return (
    <AuthCardLayout>
      <AuthCard>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No dashboard access</h2>
          <div
            style={{
              background: "var(--wt-tier-ai-bg)",
              border: "1px solid var(--wt-border)",
              borderRadius: "var(--wt-radius-md)",
              padding: "14px 16px",
              marginBottom: 20,
              textAlign: "left",
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--wt-tier-ai-text)", marginBottom: 6 }}>
              Auditor or Admin role required
            </p>
            <p style={{ fontSize: 13, color: "var(--wt-text-muted)", lineHeight: 1.5 }}>
              The node dashboard is only accessible to Auditors and Admins.
              Your account <strong>{username}</strong> has the USER role.
              Contact an admin to request access.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            style={{
              width: "100%",
              background: "var(--wt-text-muted)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--wt-radius-sm)",
              padding: "12px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Back to sign in
          </button>
        </div>
      </AuthCard>
    </AuthCardLayout>
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
      const data = (await res.json()) as {
        token?: string;
        message?: string;
        username?: string;
        role?: string;
      };
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
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 13px",
    border: "1.5px solid var(--wt-border)",
    borderRadius: "var(--wt-radius-sm)",
    fontSize: 15,
    outline: "none",
    background: "var(--wt-bg)",
    color: "var(--wt-text)",
  };

  return (
    <AuthCardLayout>
      <AuthCard>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Sign in</h1>
          <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginTop: 6 }}>
            Auditors and admins only
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="login-username" style={labelStyle}>Username</label>
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your username"
            required
            autoComplete="username"
            autoFocus
            aria-invalid={error ? true : undefined}
            style={{ ...inputStyle, marginBottom: 12 }}
          />

          <label htmlFor="login-password" style={labelStyle}>Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            aria-invalid={error ? true : undefined}
            style={{ ...inputStyle, marginBottom: 20 }}
          />

          {error && (
            <p role="alert" style={{ color: "var(--wt-danger)", fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: "var(--wt-primary)",
              color: "var(--wt-primary-contrast)",
              border: "none",
              borderRadius: "var(--wt-radius-sm)",
              padding: "12px",
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </AuthCard>
    </AuthCardLayout>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--wt-text-muted)",
  marginBottom: 5,
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
