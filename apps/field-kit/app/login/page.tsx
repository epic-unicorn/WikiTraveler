"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { WikiTravelerLogo } from "@wikitraveler/ui";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [nodeUrl, setNodeUrl] = useState(ENV_NODE_URL);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [pendingUsername, setPendingUsername] = useState("");

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
      if (!res.ok) { setError(data.message ?? "Login failed"); return; }

      const role = (data.role ?? "USER").toUpperCase();
      if (role === "USER") {
        setPendingApproval(true);
        setPendingUsername(data.username ?? username.trim().toLowerCase());
        return;
      }

      const maxAge = 30 * 24 * 60 * 60;
      document.cookie = `wt_token=${encodeURIComponent(data.token!)}; path=/; max-age=${maxAge}; SameSite=Lax`;
      sessionStorage.setItem("wt_auth_token", data.token!);
      localStorage.setItem("wt_node_url", cleanUrl);
      localStorage.setItem("wt_username", data.username ?? username.trim().toLowerCase());

      router.replace(searchParams.get("next") ?? "/");
    } catch {
      setError("Could not reach node. Check the URL and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (pendingApproval) {
    return (
      <PendingApproval
        username={pendingUsername}
        onBack={() => { setPendingApproval(false); setPendingUsername(""); }}
      />
    );
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
          <WikiTravelerLogo product="field-kit" size={36} />
        </div>
        <div style={{
          background: "var(--wt-bg-elevated)",
          borderRadius: "var(--wt-radius-lg)",
          border: "1px solid var(--wt-border)",
          padding: "36px 24px",
          boxShadow: "var(--wt-shadow)",
        }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Field Kit</h1>
            <p style={{ fontSize: 14, color: "var(--wt-text-muted)", marginTop: 6 }}>
              Sign in to start auditing
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <label style={labelStyle}>Node URL</label>
            <input
              type="url"
              value={nodeUrl}
              onChange={(e) => setNodeUrl(e.target.value)}
              placeholder="https://your-node.example.com"
              required
              style={{ ...inputStyle, marginBottom: 16 }}
            />

            <label style={labelStyle}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your username"
              required
              autoComplete="username"
              style={{ ...inputStyle, marginBottom: 12 }}
            />

            <label style={labelStyle}>Password</label>
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
              <p style={{ color: "var(--wt-danger)", fontSize: 13, marginBottom: 12 }}>{error}</p>
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

function PendingApproval({ username, onBack }: { username: string; onBack: () => void }) {
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
          <WikiTravelerLogo product="field-kit" size={36} />
        </div>
        <div style={{
          background: "var(--wt-bg-elevated)",
          borderRadius: "var(--wt-radius-lg)",
          border: "1px solid var(--wt-border)",
          padding: "36px 24px",
          boxShadow: "var(--wt-shadow)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>⏳</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Hi {username}!
          </h2>
          <div style={{
            background: "var(--wt-tier-ai-bg)",
            border: "1px solid var(--wt-border)",
            borderRadius: "var(--wt-radius-md)",
            padding: "14px 16px",
            marginBottom: 20,
            textAlign: "left",
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--wt-tier-ai-text)", marginBottom: 6 }}>
              Awaiting AUDITOR access
            </p>
            <p style={{ fontSize: 13, color: "var(--wt-text-muted)", lineHeight: 1.5 }}>
              Your account exists but you have not been granted the{" "}
              <strong>AUDITOR</strong> role yet. An admin needs to approve your access before
              you can submit field audits.
            </p>
          </div>
          <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginBottom: 20 }}>
            Once your role is upgraded, tap below to try signing in again.
          </p>
          <button
            onClick={onBack}
            style={{
              width: "100%",
              background: "var(--wt-primary)",
              color: "var(--wt-primary-contrast)",
              border: "none",
              borderRadius: "var(--wt-radius-sm)",
              padding: "13px",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
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
