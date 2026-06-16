"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FieldKitToolbar } from "../../FieldKitToolbar";
import ExistingDataPanel, { type AuditPhotos, type ExistingFact } from "./ExistingDataPanel";
import { AuditCollapsibleSection } from "./AuditCollapsibleSection";
import { RoomAuditSection } from "./RoomAuditSection";
import { resolveFactDisplay } from "../../lib/factDisplay";
import { canAccessFieldKit, clearAuth, persistAuth, readAuthToken } from "../../lib/authStorage";
import { ENV_NODE_URL } from "../../lib/fieldKitApi";
import { findRecentAudit, removeRecentAudit, upsertRecentAudit } from "../../lib/recentAudits";
import { useLocale } from "@wikitraveler/ui";
import {
  compressPhoto,
  MAX_AUDIT_PHOTOS,
  roomScopeKey,
  type AuditPhotoInput,
} from "@wikitraveler/i18n";

interface Props {
  propertyId: string;
  propertyName: string;
  location: string;
  existingFacts: ExistingFact[];
  auditPhotos: AuditPhotos | null;
  hasAiGuess: boolean;
  /** The node that hosts this property — may differ from the user's home node. */
  targetNodeUrl?: string;
}

export default function FieldAuditForm({ propertyId, propertyName, location, existingFacts, auditPhotos, hasAiGuess, targetNodeUrl }: Props) {
  const router = useRouter();
  const { locale, t, getFieldLabel, getTierLabel } = useLocale();
  const [nodeUrl, setNodeUrl] = useState(ENV_NODE_URL);
  const [mounted, setMounted] = useState(false);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [loggedInAs, setLoggedInAs] = useState<string | null>(null);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

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
      if (!canAccessFieldKit(data.role)) {
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

  // Form values — seed from existing facts, then override with saved draft
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(existingFacts.map((f) => [f.fieldName, f.value]))
  );

  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(`wt_draft_${propertyId}`);
      if (draft) setValues(JSON.parse(draft) as Record<string, string>);
    } catch { /* ignore */ }
  }, [propertyId]);

  const setValue = useCallback((name: string, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      try { sessionStorage.setItem(`wt_draft_${propertyId}`, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [propertyId]);

  const [photos, setPhotos] = useState<AuditPhotoInput[]>([]);
  const [fieldDefs, setFieldDefs] = useState<Array<{
    fieldName: string;
    scope: string;
    valueType: string;
    label: string;
    unit?: string | null;
  }>>([]);
  const [selectedRoomTypes, setSelectedRoomTypes] = useState<string[]>([]);
  const [roomValues, setRoomValues] = useState<Record<string, string>>({});
  const [roomDescriptions, setRoomDescriptions] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [loadedFacts, setLoadedFacts] = useState(existingFacts);
  const [loadedPhotos, setLoadedPhotos] = useState(auditPhotos);
  const [loadedHasAiGuess, setLoadedHasAiGuess] = useState(hasAiGuess);
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

  const propertyFields = fieldDefs.filter((f) => f.scope === "PROPERTY" && f.fieldName !== "room_types_available");
  const roomFieldDefs = fieldDefs.filter((f) => f.scope === "ROOM");

  function fieldInputType(valueType: string): "toggle" | "number" | "time" | "textarea" {
    switch (valueType) {
      case "BOOLEAN": return "toggle";
      case "NUMBER": return "number";
      case "TIME": return "time";
      default: return "textarea";
    }
  }

  // Use cached recent-list labels when SSR could not load the property.
  useEffect(() => {
    setDisplayName(propertyName);
    setDisplayLocation(location);
  }, [propertyName, location]);

  function onRoomValueChange(scopeKey: string, fieldName: string, value: string) {
    setRoomValues((prev) => ({ ...prev, [`${scopeKey}::${fieldName}`]: value }));
  }

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
    setLoadedPhotos(auditPhotos);
    setLoadedHasAiGuess(hasAiGuess);
  }, [existingFacts, auditPhotos, hasAiGuess]);

  useEffect(() => {
    if (!mounted) return;
    if (!token) {
      setPropertyLoading(false);
      return;
    }
    const url = targetNodeUrl ?? nodeUrl;
    let cancelled = false;
    setPropertyLoading(true);

    fetch(`${url}/api/properties/${encodeURIComponent(propertyId)}/accessibility`, {
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
          auditPhotos?: AuditPhotos | null;
          hasAiGuess?: boolean;
        };
        if (data.property?.name) setDisplayName(data.property.name);
        if (data.property?.location) setDisplayLocation(data.property.location);
        setLoadedFacts(data.facts ?? []);
        setLoadedPhotos(data.auditPhotos ?? null);
        setLoadedHasAiGuess(
          data.hasAiGuess ?? (data.facts ?? []).some((f) => f.tier === "AI_GUESS")
        );
      })
      .catch(() => { /* keep SSR / cached props */ })
      .finally(() => {
        if (!cancelled) setPropertyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mounted, token, propertyId, nodeUrl, targetNodeUrl]);

  function dismissMissingProperty() {
    removeRecentAudit(propertyId);
    router.push("/");
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const remaining = MAX_AUDIT_PHOTOS - photos.length;
    const files = Array.from(e.target.files ?? []).slice(0, remaining);
    const compressed = await Promise.all(files.map((f) => compressPhoto(f)));
    setPhotos((prev) =>
      [...prev, ...compressed.map((c) => ({ dataUri: c.dataUri, width: c.width, height: c.height }))].slice(0, MAX_AUDIT_PHOTOS)
    );
  }

  function updatePhotoCaption(index: number, caption: string) {
    setPhotos((prev) => prev.map((p, i) => (i === index ? { ...p, caption } : p)));
  }

  async function submit() {
    if (!token) return;
    const facts: Array<{ fieldName: string; value: string; scopeKey?: string }> = Object.entries(values)
      .filter(([, v]) => v.trim() !== "")
      .map(([fieldName, value]) => ({ fieldName, value, scopeKey: "property" }));

    if (selectedRoomTypes.length > 0) {
      facts.push({
        fieldName: "room_types_available",
        value: selectedRoomTypes.join(","),
        scopeKey: "property",
      });
    }

    for (const typeId of selectedRoomTypes) {
      const scope = roomScopeKey(typeId);
      const desc = roomDescriptions[typeId]?.trim();
      if (desc) {
        facts.push({ fieldName: "accessible_room_description", value: desc, scopeKey: scope });
      }
      for (const [key, value] of Object.entries(roomValues)) {
        if (!key.startsWith(`${scope}::`) || !value.trim()) continue;
        const fieldName = key.slice(scope.length + 2);
        facts.push({ fieldName, value, scopeKey: scope });
      }
    }

    if (facts.length === 0) {
      setErrorMsg(t("ui.fillOneField"));
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    const submitUrl = targetNodeUrl ?? nodeUrl;
    const res = await fetch(`${submitUrl}/api/properties/${encodeURIComponent(propertyId)}/accessibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ facts, photos, locale }),
    });

    if (res.status === 401) {
      logout();
      setStatus("idle");
      setAuthError(t("ui.authSessionExpired"));
      return;
    }

    if (res.ok) {
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
    } else {
      const d = await res.json() as { message?: string };
      setErrorMsg(d.message ?? t("ui.submissionFailed"));
      setStatus("error");
    }
  }

  const existingByField = Object.fromEntries(loadedFacts.map((f) => [f.fieldName, f]));

  function formatPreviousValue(fact: ExistingFact): string {
    const { displayValue } = resolveFactDisplay(fact, locale);
    const tierLabel = getTierLabel(fact.tier);
    return `${displayValue} (${tierLabel})`;
  }

  const toggleFields = propertyFields.filter((f) => fieldInputType(f.valueType) === "toggle");
  const detailFields = propertyFields.filter((f) => {
    const type = fieldInputType(f.valueType);
    return type === "number" || type === "time";
  });
  const noteFields = propertyFields.filter((f) => fieldInputType(f.valueType) === "textarea");

  if (status === "ok") {
    return (
      <>
        <FieldKitToolbar title={t("ui.auditSubmitted")} backLabel={t("ui.back")} />
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
    <>
      <FieldKitToolbar
        showBack
        backHref="/"
        backLabel={t("ui.back")}
        title={t("ui.fkAuditTitle")}
      />

      <main className="page">
        <div className="fk-property-header card">
          <h1 className="fk-property-name">{displayName}</h1>
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
                <>{t("ui.authNoAccount")}{" "}<button onClick={() => { setAuthMode("register"); setAuthError(""); }} style={{ background: "none", border: "none", color: "var(--wt-primary)", cursor: "pointer", fontSize: 12, padding: 0, fontWeight: 600 }}>{t("ui.authCreateAccount")}</button></>
              ) : (
                <>{t("ui.authHasAccount")}{" "}<button onClick={() => { setAuthMode("login"); setAuthError(""); }} style={{ background: "none", border: "none", color: "var(--wt-primary)", cursor: "pointer", fontSize: 12, padding: 0, fontWeight: 600 }}>{t("ui.signIn")}</button></>
              )}
            </p>
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
            <ExistingDataPanel
              facts={loadedFacts}
              auditPhotos={loadedPhotos}
              hasAiGuess={loadedHasAiGuess}
            />

            <div className="card fk-audit-form">
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{t("ui.accessibilityAudit")}</h2>
              <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginBottom: 4 }}>
                {t("ui.fillOnSite")}
              </p>

              {toggleFields.length > 0 && (
                <AuditCollapsibleSection title={t("ui.fkSectionChecks")} defaultOpen>
                  {toggleFields.map((field) => {
                    const existing = existingByField[field.fieldName];
                    return (
                      <label className="toggle-row" key={field.fieldName} htmlFor={`toggle-${field.fieldName}`}>
                        <div>
                          <span className="toggle-label">{field.label}</span>
                          {existing && (
                            <div style={{ fontSize: 11, color: "var(--wt-text-muted)", marginTop: 2 }}>
                              {t("ui.previously")}: {formatPreviousValue(existing)}
                            </div>
                          )}
                        </div>
                        <span className="toggle">
                          <input
                            id={`toggle-${field.fieldName}`}
                            type="checkbox"
                            checked={values[field.fieldName] === "yes"}
                            onChange={(e) => setValue(field.fieldName, e.target.checked ? "yes" : "no")}
                          />
                          <span className="toggle-slider" />
                        </span>
                      </label>
                    );
                  })}
                </AuditCollapsibleSection>
              )}

              {detailFields.length > 0 && (
                <AuditCollapsibleSection title={t("ui.fkSectionDetails")} defaultOpen={false}>
                  {detailFields.map((field) => {
                    const type = fieldInputType(field.valueType);
                    const existing = existingByField[field.fieldName];
                    return (
                      <div key={field.fieldName}>
                        <label htmlFor={field.fieldName}>
                          {field.label}
                          {field.unit && <span style={{ fontWeight: 400, color: "var(--wt-text-muted)" }}> ({field.unit})</span>}
                        </label>
                        {existing && (
                          <p style={{ fontSize: 11, color: "var(--wt-text-muted)", marginTop: -2, marginBottom: 4 }}>
                            {t("ui.previously")}: {formatPreviousValue(existing)}
                          </p>
                        )}
                        <input
                          id={field.fieldName}
                          type={type}
                          inputMode={type === "number" ? "numeric" : undefined}
                          value={values[field.fieldName] ?? ""}
                          onChange={(e) => setValue(field.fieldName, e.target.value)}
                        />
                      </div>
                    );
                  })}
                </AuditCollapsibleSection>
              )}

              {noteFields.length > 0 && (
                <AuditCollapsibleSection title={t("ui.fkSectionNotes")} defaultOpen={false}>
                  {noteFields.map((field) => {
                    const existing = existingByField[field.fieldName];
                    return (
                      <div key={field.fieldName}>
                        <label htmlFor={field.fieldName}>{field.label}</label>
                        {existing && (
                          <p style={{ fontSize: 11, color: "var(--wt-text-muted)", marginTop: -2, marginBottom: 4 }}>
                            {t("ui.previously")}: {formatPreviousValue(existing)}
                          </p>
                        )}
                        <textarea
                          id={field.fieldName}
                          value={values[field.fieldName] ?? ""}
                          onChange={(e) => setValue(field.fieldName, e.target.value)}
                        />
                      </div>
                    );
                  })}
                </AuditCollapsibleSection>
              )}
            </div>

            <RoomAuditSection
              roomFields={roomFieldDefs}
              selectedTypes={selectedRoomTypes}
              onTypesChange={setSelectedRoomTypes}
              roomValues={roomValues}
              onRoomValueChange={onRoomValueChange}
              roomDescriptions={roomDescriptions}
              onRoomDescriptionChange={(typeId, value) =>
                setRoomDescriptions((prev) => ({ ...prev, [typeId]: value }))
              }
            />

            <div className="card" style={{ marginTop: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                {t("ui.photosOptional", { max: MAX_AUDIT_PHOTOS })}
              </h2>
              <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginBottom: 12 }}>
                {t("ui.photosHint")}
              </p>
              {photos.length < MAX_AUDIT_PHOTOS && (
                <label
                  htmlFor="photos"
                  style={{
                    display: "block", textAlign: "center", padding: "20px",
                    border: "2px dashed var(--wt-border)", borderRadius: 10,
                    color: "var(--wt-text-muted)", cursor: "pointer", fontSize: 14,
                    marginTop: 0,
                  }}
                >
                  📷 {t("ui.tapAddPhoto")}
                  <input
                    id="photos"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    style={{ display: "none" }}
                    onChange={handlePhotoChange}
                  />
                </label>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {photos.map((photo, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.dataUri} alt={`Photo ${i + 1}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} />
                    <input
                      type="text"
                      placeholder={t("ui.captionPlaceholder")}
                      value={photo.caption ?? ""}
                      onChange={(e) => updatePhotoCaption(i, e.target.value)}
                      style={{ width: 80, fontSize: 10, marginTop: 4 }}
                    />
                    <button
                      type="button"
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                      style={{
                        position: "absolute", top: -6, right: -6,
                        background: "var(--wt-danger)", color: "#fff",
                        border: "none", borderRadius: "50%",
                        width: 20, height: 20, cursor: "pointer", fontSize: 12,
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>

            {status === "error" && <p className="status-err" role="alert">{errorMsg}</p>}
            {status === "loading" && (
              <p className="wt-sr-only" role="status" aria-live="polite">{t("ui.submitting")}</p>
            )}

            <button
              className="btn-primary"
              onClick={submit}
              disabled={status === "loading"}
            >
              {status === "loading" ? t("ui.submitting") : t("ui.submitAudit")}
            </button>
          </>
        )}
      </main>
    </>
  );
}
