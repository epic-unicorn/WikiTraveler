"use client";

import { useState, Suspense } from "react";
import Link from "next/link";

function RegisterForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) { setError(data.message ?? "Registration failed"); return; }
      setDone(true);
    } catch {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
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
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 10 }}>
            Account created!
          </h2>
          <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 20 }}>
            Your account <strong>{username.trim().toLowerCase()}</strong> has been registered.
          </p>
          <div style={{
            background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12,
            padding: "14px 16px", marginBottom: 20, textAlign: "left",
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1e40af", marginBottom: 6 }}>
              Next steps
            </p>
            <ol style={{ fontSize: 13, color: "#1e3a8a", lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
              <li>Close this tab</li>
              <li>Open the WikiTraveler extension</li>
              <li>Sign in with your new account</li>
            </ol>
          </div>
          <button
            onClick={() => window.close()}
            style={{
              width: "100%", background: "#1e3a5f", color: "#fff", border: "none",
              borderRadius: 10, padding: "12px", fontSize: 15, fontWeight: 600, cursor: "pointer",
            }}
          >
            Close this tab
          </button>
        </div>
      </div>
    );
  }

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "11px 13px",
    border: "1.5px solid #d1d5db", borderRadius: 10, fontSize: 15,
    outline: "none", fontFamily: "inherit", background: "#f9fafb",
    marginBottom: 14,
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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>Create account</h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>Register on this WikiTraveler node</p>
        </div>

        <form onSubmit={handleSubmit}>
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
              borderRadius: 10, padding: "12px", fontSize: 15, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", marginTop: 20 }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#1e3a5f", fontWeight: 600 }}>Sign in</Link>
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
