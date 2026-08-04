"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { WikiTravelerLogo, useLocale } from "@wikitraveler/ui";
import { DISPLAY_ENV_NODE_URL, toClientNodeUrl } from "../lib/accessApi";
import { normalizeNodeBaseUrl } from "../lib/safeHttpUrl";

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

function RegisterForm() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const [nodeUrl, setNodeUrl] = useState(ENV_NODE_URL);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const storedUrl = localStorage.getItem("wt_node_url");
    if (storedUrl) setNodeUrl(storedUrl);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    const cleanUrl = normalizeNodeBaseUrl(nodeUrl);
    if (!cleanUrl) { setError("Invalid node URL — use an http or https address."); return; }

    setLoading(true);
    try {
      const fetchUrl = toClientNodeUrl(cleanUrl);
      const res = await fetch(`${fetchUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) { setError(data.message ?? "Registration failed"); return; }

      localStorage.setItem("wt_node_url", cleanUrl);
      localStorage.setItem("wt_username", username.trim().toLowerCase());
      setDone(true);
    } catch {
      setError("Could not reach node. Check the URL and try again.");
    } finally {
      setLoading(false);
    }
  }

  const loginHref = `/login${searchParams.get("next") ? `?next=${searchParams.get("next")}` : ""}`;

  if (done) {
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
            textAlign: "center",
          }}>
            <div style={{ fontSize: 44, marginBottom: 16 }} aria-hidden="true">✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{t("ui.authRegisterSuccess")}</h2>
            <p style={{ fontSize: 14, color: "var(--wt-text)", lineHeight: 1.6, marginBottom: 16 }}>
              {t("ui.accessRegisterSuccessBody")}
            </p>
            <p style={{ fontSize: 13, color: "var(--wt-text-muted)", lineHeight: 1.5, marginBottom: 20 }}>
              {t("ui.accessRegisterAuditorNote")}
            </p>
            <Link
              href={loginHref}
              style={{
                display: "block",
                background: "var(--wt-primary)",
                color: "var(--wt-primary-contrast)",
                borderRadius: "var(--wt-radius-sm)",
                padding: "13px",
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {t("ui.accessRegisterSignIn")}
            </Link>
          </div>
        </div>
      </div>
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
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t("ui.authRegisterTitle")}</h1>
            <p style={{ fontSize: 14, color: "var(--wt-text-muted)", marginTop: 6 }}>
              {t("ui.accessRegisterSubtitle")}
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
              placeholder="your-username"
              required
              autoComplete="username"
              autoFocus
              style={{ ...inputStyle, marginBottom: 12 }}
            />

            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="at least 8 characters"
              required
              autoComplete="new-password"
              style={{ ...inputStyle, marginBottom: 12 }}
            />

            <label style={labelStyle}>Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="repeat password"
              required
              autoComplete="new-password"
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
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: 13, color: "var(--wt-text-muted)", marginTop: 20 }}>
            Already have an account?{" "}
            <Link href={loginHref} style={{ color: "var(--wt-primary)", fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
