"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const ENV_NODE_URL = process.env.NEXT_PUBLIC_NODE_API_URL ?? "http://localhost:3000";

function RegisterForm() {
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
    const cleanUrl = nodeUrl.trim().replace(/\/$/, "");
    try { new URL(cleanUrl); } catch { setError("Invalid node URL"); return; }

    setLoading(true);
    try {
      const res = await fetch(`${cleanUrl}/api/auth/register`, {
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

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 600, color: "#374151",
    marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.04em",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box" as const, padding: "12px 13px",
    border: "1.5px solid #d1d5db", borderRadius: 10, fontSize: 15,
    background: "#f9fafb", outline: "none", fontFamily: "inherit",
    marginBottom: 14,
  };

  const loginHref = `/login${searchParams.get("next") ? `?next=${searchParams.get("next")}` : ""}`;

  if (done) {
    return (
      <div style={{
        minHeight: "100dvh", background: "#f9fafb",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px 16px",
      }}>
        <div style={{
          width: "100%", maxWidth: 400, background: "#fff",
          borderRadius: 20, border: "1px solid #e5e7eb",
          padding: "36px 24px", boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 12 }}>
            Account created!
          </h2>
          <div style={{
            background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 12,
            padding: "14px 16px", marginBottom: 20, textAlign: "left",
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#92400e", marginBottom: 6 }}>
              ⏳ Waiting for AUDITOR access
            </p>
            <p style={{ fontSize: 13, color: "#78350f", lineHeight: 1.5 }}>
              Your account has been created with the <strong>USER</strong> role.
              An admin needs to promote you to <strong>AUDITOR</strong> before you can submit field audits.
            </p>
          </div>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
            Once your role is upgraded, sign in to start auditing.
          </p>
          <Link
            href={loginHref}
            style={{
              display: "block", background: "#1e3a5f", color: "#fff",
              borderRadius: 12, padding: "13px", fontSize: 15, fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100dvh", background: "#f9fafb",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px 16px",
    }}>
      <div style={{
        width: "100%", maxWidth: 400, background: "#fff",
        borderRadius: 20, border: "1px solid #e5e7eb",
        padding: "36px 24px", boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🌍</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Create account</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 6 }}>Register to become a field auditor</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Node URL</label>
          <input
            type="url"
            value={nodeUrl}
            onChange={(e) => setNodeUrl(e.target.value)}
            placeholder="https://your-node.example.com"
            required
            style={inputStyle}
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
            style={inputStyle}
          />

          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="at least 8 characters"
            required
            autoComplete="new-password"
            style={inputStyle}
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
            <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", background: "#1e3a5f", color: "#fff", border: "none",
              borderRadius: 12, padding: "14px", fontSize: 16, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", marginTop: 20 }}>
          Already have an account?{" "}
          <Link href={loginHref} style={{ color: "#1e3a5f", fontWeight: 600 }}>Sign in</Link>
        </p>
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
