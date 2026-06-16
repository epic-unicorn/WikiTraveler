"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FieldKitToolbar } from "../../FieldKitToolbar";
import ExistingDataPanel, { type AuditPhotos, type ExistingFact } from "./ExistingDataPanel";
import { resolveFactDisplay, TIER_LABELS } from "../../lib/factDisplay";
import { canAccessFieldKit, clearAuth, persistAuth, readAuthToken } from "../../lib/authStorage";
import { ENV_NODE_URL } from "../../lib/fieldKitApi";
import { findRecentAudit, removeRecentAudit, upsertRecentAudit } from "../../lib/recentAudits";

interface AuditField {
  name: string;
  label: string;
  type: "toggle" | "number" | "time" | "textarea";
  unit?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}

const FIELDS: AuditField[] = [
  { name: "door_width_cm", label: "Door Width", type: "number", unit: "cm", placeholder: "e.g. 90", min: 30, max: 500 },
  { name: "ramp_present", label: "Ramp Present", type: "toggle" },
  { name: "elevator_present", label: "Elevator Present", type: "toggle" },
  { name: "elevator_floor_count", label: "Elevator Floors", type: "number", placeholder: "e.g. 5", min: 1, max: 200 },
  { name: "step_free_entrance", label: "Step-Free Entrance", type: "toggle" },
  { name: "accessible_bathroom", label: "Accessible Bathroom", type: "toggle" },
  { name: "hearing_loop", label: "Hearing Loop", type: "toggle" },
  { name: "braille_signage", label: "Braille Signage", type: "toggle" },
  { name: "parking_accessible", label: "Accessible Parking", type: "toggle" },
  { name: "quiet_hours_start", label: "Quiet Hours Start", type: "time" },
  { name: "quiet_hours_end", label: "Quiet Hours End", type: "time" },
  { name: "notes", label: "Additional Notes", type: "textarea", placeholder: "Any extra details…" },
];

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

  const [photos, setPhotos] = useState<string[]>([]);
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
    setDisplayName(propertyName);
    setDisplayLocation(location);
  }, [propertyName, location]);

  // Use cached recent-list labels when SSR could not load the property.
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
    const files = Array.from(e.target.files ?? []).slice(0, 3 - photos.length);
    const encoded = await Promise.all(
      files.map(
        (f) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(f);
          })
      )
    );
    setPhotos((prev) => [...prev, ...encoded].slice(0, 3));
  }

  async function submit() {
    if (!token) return;
    const facts = Object.entries(values)
      .filter(([, v]) => v.trim() !== "")
      .map(([fieldName, value]) => ({ fieldName, value }));

    if (facts.length === 0) {
      setErrorMsg("Fill in at least one field before submitting.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    const submitUrl = targetNodeUrl ?? nodeUrl;
    const res = await fetch(`${submitUrl}/api/properties/${encodeURIComponent(propertyId)}/accessibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ facts, photoUrls: photos }),
    });

    if (res.status === 401) {
      logout();
      setStatus("idle");
      setAuthError("Session expired — please log in again.");
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
      setErrorMsg(d.message ?? "Submission failed");
      setStatus("error");
    }
  }

  const existingByField = Object.fromEntries(loadedFacts.map((f) => [f.fieldName, f]));

  function formatPreviousValue(fact: ExistingFact): string {
    const { displayValue } = resolveFactDisplay(fact);
    const tierLabel = TIER_LABELS[fact.tier] ?? fact.tier;
    return `${displayValue} (${tierLabel})`;
  }

  if (status === "ok") {
    return (
      <>
        <FieldKitToolbar title="Audit submitted!" />
        <main id="main-content" className="page" role="status" aria-live="polite">
          <div className="card" style={{ textAlign: "center", paddingTop: 32, paddingBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Thank you!</h2>
            <p className="status-muted" style={{ marginBottom: 24 }}>
              Your audit for <strong>{displayName}</strong> has been recorded.
            </p>
            <button className="btn-secondary" onClick={() => router.push("/")}>
              Audit another property
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
        title={displayName}
      />

      <main className="page">
        <p className="wt-fk-page-lead">
          {targetNodeUrl && targetNodeUrl !== nodeUrl
            ? `Remote audit · ${new URL(targetNodeUrl).hostname}`
            : displayLocation}
        </p>

        {/* Auth gate — only rendered after client hydration to avoid mismatch */}
        {!mounted ? (
          <div className="card" style={{ textAlign: "center", padding: "32px 16px", color: "var(--wt-text-muted)" }}>Loading…</div>
        ) : !token ? (
              <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              {authMode === "login" ? "Log in to submit" : "Create an account"}
            </h2>
            <label htmlFor="audit-username">Username</label>
            <input
              id="audit-username"
              type="text"
              autoComplete="username"
              placeholder="your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (authMode === "login" ? login() : register())}
            />
            <label htmlFor="audit-password">Password</label>
            <input
              id="audit-password"
              type="password"
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (authMode === "login" ? login() : register())}
            />
            {authError && <p className="status-err" role="alert">{authError}</p>}
            <button className="btn-primary" onClick={authMode === "login" ? login : register} disabled={authLoading}>
              {authLoading ? "…" : authMode === "login" ? "Log in" : "Create account"}
            </button>
            <p style={{ fontSize: 12, color: "var(--wt-text-muted)", marginTop: 12, textAlign: "center" }}>
              {authMode === "login" ? (
                <>No account? <button onClick={() => { setAuthMode("register"); setAuthError(""); }} style={{ background: "none", border: "none", color: "var(--wt-primary)", cursor: "pointer", fontSize: 12, padding: 0, fontWeight: 600 }}>Register</button></>
              ) : (
                <>Already have an account? <button onClick={() => { setAuthMode("login"); setAuthError(""); }} style={{ background: "none", border: "none", color: "var(--wt-primary)", cursor: "pointer", fontSize: 12, padding: 0, fontWeight: 600 }}>Log in</button></>
              )}
            </p>
          </div>
        ) : propertyMissing ? (
          <div className="card" role="alert">
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Property no longer on this node
            </h2>
            <p className="status-muted" style={{ marginBottom: 16 }}>
              <strong>{displayName}</strong> is not in the node database anymore. That often
              happens after a database reset or re-seed — the recent list still has your old
              audit, but the property ID no longer exists. Search for the property again to
              re-audit it.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn-primary" onClick={() => router.push("/")}>
                Search properties
              </button>
              <button className="btn-secondary" onClick={dismissMissingProperty}>
                Remove from recent
              </button>
            </div>
          </div>
        ) : propertyLoading ? (
          <div className="card" style={{ textAlign: "center", padding: "32px 16px", color: "var(--wt-text-muted)" }}>
            Loading property…
          </div>
        ) : (
          <>
            {/* Logged-in indicator */}
            {loggedInAs && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, fontSize: 12, color: "var(--wt-text-muted)" }}>
                <span>Logged in as <strong style={{ color: "var(--wt-text)" }}>{loggedInAs}</strong></span>
                <button onClick={logout} style={{ background: "none", border: "none", color: "var(--wt-text-muted)", cursor: "pointer", fontSize: 12 }}>Log out</button>
              </div>
            )}

            <ExistingDataPanel
              facts={loadedFacts}
              auditPhotos={loadedPhotos}
              hasAiGuess={loadedHasAiGuess}
            />

            {/* Accessibility fields */}
              <div className="card">
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Accessibility Audit</h2>
              <p style={{ fontSize: 13, color: "var(--wt-text-muted)" }}>
                Fill in what you can observe on-site. Leave unknown fields blank.
              </p>

              {/* Toggles */}
              <div style={{ marginTop: 16 }}>
                {FIELDS.filter((f) => f.type === "toggle").map((field) => {
                  const existing = existingByField[field.name];
                  return (
                    <label className="toggle-row" key={field.name} htmlFor={`toggle-${field.name}`}>
                      <div>
                        <span className="toggle-label">{field.label}</span>
                        {existing && (
                          <div style={{ fontSize: 11, color: "var(--wt-text-muted)", marginTop: 2 }}>
                            Previously: {formatPreviousValue(existing)}
                          </div>
                        )}
                      </div>
                      <span className="toggle">
                        <input
                          id={`toggle-${field.name}`}
                          type="checkbox"
                          checked={values[field.name] === "yes"}
                          onChange={(e) => setValue(field.name, e.target.checked ? "yes" : "no")}
                        />
                        <span className="toggle-slider" />
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* Numeric & text inputs */}
              {FIELDS.filter((f) => f.type !== "toggle").map((field) => {
                const existing = existingByField[field.name];
                return (
                  <div key={field.name}>
                    <label htmlFor={field.name}>
                      {field.label}
                      {field.unit && <span style={{ fontWeight: 400, color: "var(--wt-text-muted)" }}> ({field.unit})</span>}
                    </label>
                    {existing && (
                      <p style={{ fontSize: 11, color: "var(--wt-text-muted)", marginTop: -2, marginBottom: 4 }}>
                        Previously: {formatPreviousValue(existing)}
                      </p>
                    )}
                    {field.type === "textarea" ? (
                      <textarea
                        id={field.name}
                        placeholder={field.placeholder ?? ""}
                        value={values[field.name] ?? ""}
                        onChange={(e) => setValue(field.name, e.target.value)}
                      />
                    ) : (
                      <input
                        id={field.name}
                        type={field.type}
                        inputMode={field.type === "number" ? "numeric" : undefined}
                        placeholder={field.placeholder ?? ""}
                        value={values[field.name] ?? ""}
                        onChange={(e) => setValue(field.name, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Photo upload */}
            <div className="card" style={{ marginTop: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Photos (optional, max 3)</h2>
              <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginBottom: 12 }}>
                Attach evidence photos. Stored securely on the node.
              </p>
              {photos.length < 3 && (
                <label
                  htmlFor="photos"
                  style={{
                    display: "block", textAlign: "center", padding: "20px",
                    border: "2px dashed var(--wt-border)", borderRadius: 10,
                    color: "var(--wt-text-muted)", cursor: "pointer", fontSize: 14,
                    marginTop: 0,
                  }}
                >
                  📷 Tap to add photo
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
                {photos.map((src, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Photo ${i + 1}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} />
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
              <p className="wt-sr-only" role="status" aria-live="polite">Submitting audit…</p>
            )}

            <button
              className="btn-primary"
              onClick={submit}
              disabled={status === "loading"}
            >
              {status === "loading" ? "Submitting…" : "Submit Audit"}
            </button>
          </>
        )}
      </main>
    </>
  );
}
