"use client";

import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "@wikitraveler/ui";
import { AuthCard, AuthCardLayout } from "../AuthCardLayout";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--wt-text-muted)",
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 13px",
  border: "1.5px solid var(--wt-border)",
  borderRadius: "var(--wt-radius-sm)",
  fontSize: 15,
  outline: "none",
  fontFamily: "inherit",
  background: "var(--wt-bg)",
  color: "var(--wt-text)",
};

function RegisterForm() {
  const { t } = useLocale();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/register")
      .then((r) => r.json())
      .then((d: { openRegistration?: boolean }) => setRegistrationOpen(d.openRegistration !== false))
      .catch(() => setRegistrationOpen(true));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("ui.authPasswordMismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("ui.authPasswordMinLength"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) {
        setError(data.message ?? t("ui.authRegisterFailed"));
        return;
      }
      setDone(true);
    } catch {
      setError(t("ui.authServerUnreachable"));
    } finally {
      setLoading(false);
    }
  }

  const registeredName = username.trim().toLowerCase();

  if (done) {
    return (
      <AuthCardLayout>
        <AuthCard>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 16 }} aria-hidden="true">✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{t("ui.authRegisterSuccess")}</h2>
            <p style={{ fontSize: 14, color: "var(--wt-text)", lineHeight: 1.6, marginBottom: 20 }}>
              {t("ui.authRegisterRegisteredAs", { username: registeredName })}
            </p>
            <div style={{
              background: "var(--wt-tier-confirmed-bg)",
              border: "1px solid var(--wt-border)",
              borderRadius: "var(--wt-radius-md)",
              padding: "14px 16px",
              marginBottom: 20,
              textAlign: "left",
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--wt-tier-confirmed-text)", marginBottom: 6 }}>
                {t("ui.authRegisterNextSteps")}
              </p>
              <ol style={{ fontSize: 13, color: "var(--wt-text-muted)", lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
                <li>{t("ui.authRegisterStepCloseTab")}</li>
                <li>{t("ui.authRegisterStepOpenExtension")}</li>
                <li>{t("ui.authRegisterStepSignIn")}</li>
              </ol>
            </div>
            <button
              type="button"
              onClick={() => window.close()}
              style={{
                width: "100%",
                background: "var(--wt-primary)",
                color: "var(--wt-primary-contrast)",
                border: "none",
                borderRadius: "var(--wt-radius-sm)",
                padding: "12px",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t("ui.authRegisterCloseTab")}
            </button>
          </div>
        </AuthCard>
      </AuthCardLayout>
    );
  }

  if (registrationOpen === false) {
    return (
      <AuthCardLayout>
        <AuthCard>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t("ui.authRegisterTitle")}</h1>
            <p style={{ fontSize: 14, color: "var(--wt-text-muted)", marginTop: 16 }}>
              {t("ui.authRegistrationClosed")}
            </p>
            <p style={{ fontSize: 13, marginTop: 20 }}>
              <Link href="/login" style={{ color: "var(--wt-primary)", fontWeight: 600 }}>{t("ui.signIn")}</Link>
            </p>
          </div>
        </AuthCard>
      </AuthCardLayout>
    );
  }

  return (
    <AuthCardLayout>
      <AuthCard>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t("ui.authRegisterTitle")}</h1>
          <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginTop: 6 }}>
            {t("ui.authRegisterSubtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="register-username" style={labelStyle}>{t("ui.username")}</label>
          <input
            id="register-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("ui.authRegisterUsernamePlaceholder")}
            required
            autoComplete="username"
            autoFocus
            aria-invalid={error ? true : undefined}
            style={{ ...inputStyle, marginBottom: 12 }}
          />

          <label htmlFor="register-password" style={labelStyle}>{t("ui.password")}</label>
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("ui.authPasswordPlaceholder")}
            required
            autoComplete="new-password"
            aria-invalid={error ? true : undefined}
            style={{ ...inputStyle, marginBottom: 12 }}
          />

          <label htmlFor="register-confirm" style={labelStyle}>{t("ui.authConfirmPassword")}</label>
          <input
            id="register-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t("ui.authConfirmPasswordPlaceholder")}
            required
            autoComplete="new-password"
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
            {loading ? t("ui.authRegisterCreating") : t("ui.authCreateAccount")}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--wt-text-muted)", marginTop: 20 }}>
          {t("ui.authHasAccount")}{" "}
          <Link href="/login" style={{ color: "var(--wt-primary)", fontWeight: 600 }}>{t("ui.signIn")}</Link>
        </p>
      </AuthCard>
    </AuthCardLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
