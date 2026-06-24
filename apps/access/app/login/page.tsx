"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { WikiTravelerLogo } from "@wikitraveler/ui";
import { persistAuth } from "../lib/authStorage";

const ENV_NODE_URL = process.env.NEXT_PUBLIC_NODE_API_URL ?? "http://localhost:3000";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--wt-text-muted)",
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  border: "1.5px solid var(--wt-border)",
  borderRadius: "var(--wt-radius-sm)",
  fontSize: 15,
  background: "var(--wt-bg)",
  color: "var(--wt-text)",
  outline: "none",
  fontFamily: "inherit",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const [nodeUrl, setNodeUrl] = useState(ENV_NODE_URL);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUrl = localStorage.getItem("wt_node_url");
    if (storedUrl) setNodeUrl(storedUrl);
    const storedUser = localStorage.getItem("wt_username");
    if (storedUser) setUsername(storedUser);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const cleanUrl = nodeUrl.trim().replace(/\/$/, "");
    try { new URL(cleanUrl); } catch { setError("Invalid node URL"); return; }

    setLoading(true);
    try {
      const res = await fetch(`${cleanUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json() as { token?: string; message?: string; username?: string; role?: string };
      if (!res.ok) {
        setError(data.message ?? `Login failed (${res.status})`);
        return;
      }
      if (!data.token) {
        setError("Login succeeded but no token was returned. Check the node logs.");
        return;
      }

      persistAuth(data.token, data.username ?? username.trim().toLowerCase(), cleanUrl);

      const next = searchParams.get("next") ?? "/";
      window.location.assign(next);
    } catch {
      setError(`Could not reach node at ${cleanUrl}. Is it running? Check the Node URL above.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--wt-bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px 16px",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <WikiTravelerLogo product="access" size={36} />
        </div>
        <div style={{
          background: "var(--wt-bg-elevated)",
          borderRadius: "var(--wt-radius-lg)",
          border: "1px solid var(--wt-border)",
          padding: "36px 24px",
          boxShadow: "var(--wt-shadow)",
        }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>WikiTraveler Access</h1>
            <p style={{ fontSize: 14, color: "var(--wt-text-muted)", marginTop: 6 }}>
              Sign in to explore verified accessibility
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="fk-login-node-url" style={labelStyle}>Node URL</label>
            <input
              id="fk-login-node-url"
              type="url"
              value={nodeUrl}
              onChange={(e) => setNodeUrl(e.target.value)}
              placeholder="https://your-node.example.com"
              required
              style={{ ...inputStyle, marginBottom: 16 }}
            />

            <label htmlFor="fk-login-username" style={labelStyle}>Username</label>
            <input
              id="fk-login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your username"
              required
              autoComplete="username"
              style={{ ...inputStyle, marginBottom: 12 }}
            />

            <label htmlFor="fk-login-password" style={labelStyle}>Password</label>
            <input
              id="fk-login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
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
                padding: "14px",
                fontSize: 16,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: 13, color: "var(--wt-text-muted)", marginTop: 20 }}>
            No account?{" "}
            <Link
              href={`/register${searchParams.get("next") ? `?next=${searchParams.get("next")}` : ""}`}
              style={{ color: "var(--wt-primary)", fontWeight: 600 }}
            >
              Register
            </Link>
          </p>
        </div>
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
