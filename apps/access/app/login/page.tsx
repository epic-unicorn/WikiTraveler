"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { WikiTravelerLogo, useLocale } from "@wikitraveler/ui";
import { persistAuth } from "../lib/authStorage";
import { DISPLAY_ENV_NODE_URL, toClientNodeUrl } from "../lib/accessApi";
import { normalizeNodeBaseUrl } from "../lib/safeHttpUrl";
import { useNodeOpenRegistration } from "../hooks/useNodeOpenRegistration";

const ENV_NODE_URL = DISPLAY_ENV_NODE_URL;

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
  const { t } = useLocale();
  const [nodeUrl, setNodeUrl] = useState(ENV_NODE_URL);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const openRegistration = useNodeOpenRegistration(nodeUrl);

  useEffect(() => {
    const storedUrl = localStorage.getItem("wt_node_url");
    if (storedUrl) setNodeUrl(storedUrl);
    const storedUser = localStorage.getItem("wt_username");
    if (storedUser) setUsername(storedUser);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const cleanUrl = normalizeNodeBaseUrl(nodeUrl);
    if (!cleanUrl) {
      setError("Invalid node URL — use an http or https address.");
      return;
    }

    setLoading(true);
    try {
      const fetchUrl = toClientNodeUrl(cleanUrl);
      const res = await fetch(`${fetchUrl}/api/auth/login`, {
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
      // Same-origin relative paths only — blocks open redirects.
      const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      window.location.assign(safeNext);
    } catch {
      setError(`Could not reach node at ${cleanUrl}. Is it running? Check the Node URL above.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fk-auth-page">
      <div className="fk-auth-page__inner">
        <div className="fk-auth-page__brand">
          <WikiTravelerLogo product="access" size={36} />
        </div>
        <div className="fk-auth-card">
          <h1 className="wt-sr-only">{t("ui.signIn")}</h1>
          <p className="fk-auth-card__lead">
            Sign in to explore verified accessibility
          </p>

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

          {openRegistration === true && (
            <p style={{ textAlign: "center", fontSize: 13, color: "var(--wt-text-muted)", marginTop: 20 }}>
              {t("ui.authNoAccount")}{" "}
              <Link
                href={`/register${searchParams.get("next") ? `?next=${searchParams.get("next")}` : ""}`}
                style={{ color: "var(--wt-primary)", fontWeight: 600 }}
              >
                {t("ui.authCreateAccount")}
              </Link>
            </p>
          )}
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
