"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AccessToolbar } from "../../AccessToolbar";
import { type ExistingFact } from "./ExistingDataPanel";
import { AuditWizard } from "./AuditWizard";
import { clearAuth, persistAuth, readAuthToken } from "../../lib/authStorage";
import { canContribute, roleFromToken } from "../../lib/userRole";
import { propertyHref } from "../../lib/propertyHref";
import { ENV_NODE_URL, type AuditPhotoItem } from "../../lib/accessApi";
import { findRecentAudit, removeRecentAudit, upsertRecentAudit } from "../../lib/recentAudits";
import { useNodeOpenRegistration } from "../../hooks/useNodeOpenRegistration";
import { useLocale } from "@wikitraveler/ui";

interface Props {
  propertyId: string;
  propertyName: string;
  location: string;
  existingFacts: ExistingFact[];
  /** The node that hosts this property — may differ from the user's home node. */
  targetNodeUrl?: string;
  existingPhotos?: AuditPhotoItem[];
}

export default function FieldAuditForm({
  propertyId,
  propertyName,
  location,
  existingFacts,
  targetNodeUrl,
  existingPhotos: initialPhotos = [],
}: Props) {
  const router = useRouter();
  const { locale, t, getTierLabel } = useLocale();
  const [nodeUrl, setNodeUrl] = useState(ENV_NODE_URL);
  const [mounted, setMounted] = useState(false);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [loggedInAs, setLoggedInAs] = useState<string | null>(null);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const openRegistration = useNodeOpenRegistration(nodeUrl);

  useEffect(() => {
    const storedUrl = localStorage.getItem("wt_node_url");
    if (storedUrl) setNodeUrl(storedUrl);

    // Populate auth state from storage — must happen client-side only
    const fromSession = readAuthToken();
    if (fromSession) {
      setToken(fromSession);
    }
    setLoggedInAs(localStorage.getItem("wt_username"));
    setMounted(true);
  }, []);

  async function login() {
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch(`${nodeUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      const data = await res.json() as { token?: string; username?: string; message?: string; role?: string };
      if (!res.ok) { setAuthError(data.message ?? "Invalid credentials"); return; }
      if (!data.token) { setAuthError("No token returned from node."); return; }
      if (!canContribute((data.role ?? "USER").toUpperCase() as "USER" | "AUDITOR" | "ADMIN")) {
        setAuthError("Your account needs the AUDITOR or ADMIN role. Ask a node admin to upgrade you.");
        return;
      }
      persistAuth(data.token, data.username ?? username.trim().toLowerCase(), nodeUrl);
      setToken(data.token);
      setLoggedInAs(data.username ?? username);
    } catch {
      setAuthError("Could not reach the node. Check settings.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function register() {
    setAuthError("");
    setAuthLoading(true);
    try {
      const regRes = await fetch(`${nodeUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      const regData = await regRes.json() as { message?: string };
      if (!regRes.ok) { setAuthError(regData.message ?? "Registration failed"); setAuthLoading(false); return; }
      await login();
    } catch {
      setAuthError("Could not reach the node. Check settings.");
      setAuthLoading(false);
    }
  }

  function logout() {
    clearAuth();
    setToken(null);
    setLoggedInAs(null);
    setUsername("");
    setPassword("");
  }

  const [fieldDefs, setFieldDefs] = useState<Array<{
    fieldName: string;
    scope: string;
    valueType: string;
    label: string;
    unit?: string | null;
    enumValues?: string[];
  }>>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [loadedFacts, setLoadedFacts] = useState(existingFacts);
  const [existingPhotos, setExistingPhotos] = useState<AuditPhotoItem[]>(initialPhotos);
  const [displayName, setDisplayName] = useState(propertyName);
  const [displayLocation, setDisplayLocation] = useState(location);
  const [propertyMissing, setPropertyMissing] = useState(false);
  const [propertyLoading, setPropertyLoading] = useState(true);

  useEffect(() => {
    const url = targetNodeUrl ?? nodeUrl;
    fetch(`${url}/api/fields?locale=${locale}`)
      .then((r) => r.json())
      .then((data: { fields?: typeof fieldDefs }) => {
        setFieldDefs(data.fields ?? []);
      })
      .catch(() => {});
  }, [locale, nodeUrl, targetNodeUrl]);

  useEffect(() => {
    setDisplayName(propertyName);
    setDisplayLocation(location);
  }, [propertyName, location]);

  useEffect(() => {
    if (propertyName !== "Unknown Property" && location !== "Unknown Location") return;
    const cached = findRecentAudit(propertyId);
    if (cached) {
      setDisplayName(cached.name);
      setDisplayLocation(cached.location);
    }
  }, [propertyId, propertyName, location]);

  useEffect(() => {
    setLoadedFacts(existingFacts);
  }, [existingFacts]);

  useEffect(() => {
    setExistingPhotos(initialPhotos);
  }, [initialPhotos]);

  useEffect(() => {
    if (!mounted) return;
    if (!token) {
      setPropertyLoading(false);
      return;
    }
    const url = targetNodeUrl ?? nodeUrl;
    let cancelled = false;
    setPropertyLoading(true);

    fetch(`${url}/api/properties/${encodeURIComponent(propertyId)}/accessibility?locale=${locale}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setPropertyMissing(true);
          const cached = findRecentAudit(propertyId);
          if (cached) {
            setDisplayName(cached.name);
            setDisplayLocation(cached.location);
          }
          return;
        }
        if (!res.ok) return;
        setPropertyMissing(false);
        const data = (await res.json()) as {
          property?: { name?: string; location?: string };
          facts?: ExistingFact[];
          auditPhotos?: { photos?: AuditPhotoItem[] } | null;
        };
        if (data.property?.name) setDisplayName(data.property.name);
        if (data.property?.location) setDisplayLocation(data.property.location);
        setLoadedFacts(data.facts ?? []);
        setExistingPhotos(data.auditPhotos?.photos ?? []);
      })
      .catch(() => { /* keep SSR / cached props */ })
      .finally(() => {
        if (!cancelled) setPropertyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mounted, token, propertyId, nodeUrl, targetNodeUrl, locale]);

  function dismissMissingProperty() {
    removeRecentAudit(propertyId);
    router.push("/");
  }

  if (status === "ok") {
    return (
      <>
        <AccessToolbar showBack showAccount={false} title={t("ui.auditSubmitted")} backLabel={t("ui.back")} />
        <main id="main-content" className="page" role="status" aria-live="polite">
          <div className="card" style={{ textAlign: "center", paddingTop: 32, paddingBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{t("ui.thankYou")}</h2>
            <p className="status-muted" style={{ marginBottom: 24 }}>
              {t("ui.thankYouBody", { name: displayName })}
            </p>
            <button className="btn-secondary" onClick={() => router.push("/")}>
              {t("ui.auditAnother")}
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <div className="fk-shell fk-audit-page">
      <AccessToolbar showBack showAccount={false} title={t("ui.verifyAccess")} />

      <main className="page fk-main">
        <div className="fk-property-lead">
          <h1 className="fk-property-title fk-property-title--section">{displayName}</h1>
          {displayLocation && displayLocation !== displayName ? (
            <p className="fk-property-location">{displayLocation}</p>
          ) : null}
          {targetNodeUrl && targetNodeUrl !== nodeUrl ? (
            <p className="fk-property-remote">
              {t("ui.remoteAudit", { host: new URL(targetNodeUrl).hostname })}
            </p>
          ) : null}
        </div>

        {/* Auth gate — only rendered after client hydration to avoid mismatch */}
        {!mounted ? (
          <div className="card" style={{ textAlign: "center", padding: "32px 16px", color: "var(--wt-text-muted)" }}>{t("ui.loading")}</div>
        ) : !token ? (
              <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              {authMode === "login" ? t("ui.authLogInToAudit") : t("ui.authCreateAccount")}
            </h2>
            <label htmlFor="audit-username">{t("ui.username")}</label>
            <input
              id="audit-username"
              type="text"
              autoComplete="username"
              placeholder={t("ui.authRegisterUsernamePlaceholder")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (authMode === "login" ? login() : register())}
            />
            <label htmlFor="audit-password">{t("ui.password")}</label>
            <input
              id="audit-password"
              type="password"
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
              placeholder={t("ui.authPasswordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (authMode === "login" ? login() : register())}
            />
            {authError && <p className="status-err" role="alert">{authError}</p>}
            <button className="btn-primary" onClick={authMode === "login" ? login : register} disabled={authLoading}>
              {authLoading ? "…" : authMode === "login" ? t("ui.signIn") : t("ui.authCreateAccount")}
            </button>
            <p style={{ fontSize: 12, color: "var(--wt-text-muted)", marginTop: 12, textAlign: "center" }}>
              {authMode === "login" ? (
                <>
                  {openRegistration === true ? (
                    <>
                      {t("ui.authNoAccount")}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("register");
                          setAuthError("");
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--wt-primary)",
                          cursor: "pointer",
                          fontSize: 12,
                          padding: 0,
                          fontWeight: 600,
                        }}
                      >
                        {t("ui.authCreateAccount")}
                      </button>
                    </>
                  ) : null}
                </>
              ) : (
                <>{t("ui.authHasAccount")}{" "}<button onClick={() => { setAuthMode("login"); setAuthError(""); }} style={{ background: "none", border: "none", color: "var(--wt-primary)", cursor: "pointer", fontSize: 12, padding: 0, fontWeight: 600 }}>{t("ui.signIn")}</button></>
              )}
            </p>
          </div>
        ) : !canContribute(roleFromToken(token)) ? (
          <div className="card" role="alert">
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              {t("ui.authRoleRequired")}
            </h2>
            <p className="status-muted" style={{ marginBottom: 16 }}>
              {t("ui.accessAuditDeniedBody")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link
                href={propertyHref(propertyId, targetNodeUrl ?? nodeUrl, nodeUrl)}
                className="btn-primary"
                style={{ textAlign: "center", textDecoration: "none" }}
              >
                {t("ui.mapViewProperty")}
              </Link>
              <button type="button" className="btn-secondary" onClick={logout}>
                {t("ui.signOut")}
              </button>
            </div>
          </div>
        ) : propertyMissing ? (
          <div className="card" role="alert">
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              {t("ui.propertyMissingTitle")}
            </h2>
            <p className="status-muted" style={{ marginBottom: 16 }}>
              {t("ui.propertyMissingBody", { name: displayName })}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn-primary" onClick={() => router.push("/")}>
                {t("ui.searchProperties")}
              </button>
              <button className="btn-secondary" onClick={dismissMissingProperty}>
                {t("ui.removeFromRecent")}
              </button>
            </div>
          </div>
        ) : propertyLoading ? (
          <div className="card" style={{ textAlign: "center", padding: "32px 16px", color: "var(--wt-text-muted)" }}>
            {t("ui.loadingProperty")}
          </div>
        ) : (
          <>
            <AuditWizard
              propertyId={propertyId}
              token={token}
              nodeUrl={nodeUrl}
              targetNodeUrl={targetNodeUrl}
              locale={locale}
              fieldDefs={fieldDefs}
              loadedFacts={loadedFacts}
              existingPhotos={existingPhotos}
              t={t}
              getTierLabel={getTierLabel}
              onSuccess={() => {
                sessionStorage.removeItem(`wt_draft_${propertyId}`);
                try {
                  upsertRecentAudit({
                    id: propertyId,
                    name: displayName,
                    location: displayLocation,
                    auditedAt: new Date().toISOString(),
                    nodeUrl: targetNodeUrl ?? nodeUrl,
                  });
                } catch { /* ignore */ }
                setStatus("ok");
              }}
              onError={(msg) => {
                setErrorMsg(msg);
                setStatus("error");
              }}
            />
            {status === "error" && <p className="status-err" role="alert">{errorMsg}</p>}
          </>
        )}
      </main>
    </div>
  );
}
