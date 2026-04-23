"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const ENV_NODE_URL = process.env.NEXT_PUBLIC_NODE_API_URL ?? "http://localhost:3000";

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

interface ExistingFact { fieldName: string; value: string; tier: string; }

interface Props {
  propertyId: string;
  propertyName: string;
  location: string;
  existingFacts: ExistingFact[];
  /** The node that hosts this property — may differ from the user's home node. */
  targetNodeUrl?: string;
}

export default function FieldAuditForm({ propertyId, propertyName, location, existingFacts, targetNodeUrl }: Props) {
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
    const fromSession = sessionStorage.getItem("wt_auth_token");
    if (fromSession) {
      setToken(fromSession);
    } else {
      const m = document.cookie.match(/(?:^|;\s*)wt_token=([^;]+)/);
      const fromCookie = m ? decodeURIComponent(m[1]) : null;
      if (fromCookie) {
        sessionStorage.setItem("wt_auth_token", fromCookie);
        setToken(fromCookie);
      }
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
      const data = await res.json() as { token?: string; username?: string; message?: string };
      if (!res.ok) { setAuthError(data.message ?? "Invalid credentials"); return; }
      const t = data.token ?? "";
      sessionStorage.setItem("wt_auth_token", t);
      localStorage.setItem("wt_username", data.username ?? username);
      setToken(t);
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
    sessionStorage.removeItem("wt_auth_token");
    localStorage.removeItem("wt_username");
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
      // Record in recently audited list
      try {
        const key = "wt_recent_audits";
        const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as Array<{ id: string; name: string; location: string; auditedAt: string }>;
        const updated = [
          { id: propertyId, name: propertyName, location, auditedAt: new Date().toISOString() },
          ...existing.filter((e) => e.id !== propertyId),
        ].slice(0, 10);
        localStorage.setItem(key, JSON.stringify(updated));
      } catch { /* ignore */ }
      setStatus("ok");
    } else {
      const d = await res.json() as { message?: string };
      setErrorMsg(d.message ?? "Submission failed");
      setStatus("error");
    }
  }

  const existingByField = Object.fromEntries(existingFacts.map((f) => [f.fieldName, f]));

  // One-line data quality summary shown at top of form
  const confirmedCount = existingFacts.filter((f) => f.tier === "CONFIRMED" || f.tier === "VERIFIED").length;
  const aiCount = existingFacts.filter((f) => f.tier === "AI_GUESS").length;

  if (status === "ok") {
    return (
      <>
        <header>
          <span style={{ fontSize: 24 }}>✅</span>
          <h1>Audit Submitted!</h1>
        </header>
        <main className="page">
          <div className="card" style={{ textAlign: "center", paddingTop: 32, paddingBottom: 32 }}>
            <p style={{ fontSize: 40, marginBottom: 16 }}>🎉</p>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Thank you!</h2>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
              Your audit for <strong>{propertyName}</strong> has been recorded.
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
      <header>
        <button
          onClick={() => router.push("/")}
          aria-label="Back"
          style={{ background: "none", border: "none", color: "#93c5fd", fontSize: 20, cursor: "pointer", padding: "0 4px" }}
        >←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{propertyName}</h1>
          <p style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>📍 {location}</p>
          {targetNodeUrl && targetNodeUrl !== nodeUrl && (
            <p style={{ fontSize: 10, color: "#f59e0b", marginTop: 1 }}>📤 Remote audit · {new URL(targetNodeUrl).hostname}</p>
          )}
        </div>
      </header>

      <main className="page">

        {/* Auth gate — only rendered after client hydration to avoid mismatch */}
        {!mounted ? (
          <div className="card" style={{ textAlign: "center", padding: "32px 16px", color: "#9ca3af" }}>Loading…</div>
        ) : !token ? (
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              {authMode === "login" ? "Log in to submit" : "Create an account"}
            </h2>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (authMode === "login" ? login() : register())}
            />
            <label htmlFor="password" style={{ marginTop: 12 }}>Password</label>
            <input
              id="password"
              type="password"
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (authMode === "login" ? login() : register())}
            />
            {authError && <p className="status-err">{authError}</p>}
            <button className="btn-primary" onClick={authMode === "login" ? login : register} disabled={authLoading}>
              {authLoading ? "…" : authMode === "login" ? "Log in" : "Create account"}
            </button>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 12, textAlign: "center" }}>
              {authMode === "login" ? (
                <>No account? <button onClick={() => { setAuthMode("register"); setAuthError(""); }} style={{ background: "none", border: "none", color: "#1e3a5f", cursor: "pointer", fontSize: 12, padding: 0 }}>Register</button></>
              ) : (
                <>Already have an account? <button onClick={() => { setAuthMode("login"); setAuthError(""); }} style={{ background: "none", border: "none", color: "#1e3a5f", cursor: "pointer", fontSize: 12, padding: 0 }}>Log in</button></>
              )}
            </p>
          </div>
        ) : (
          <>
            {/* Logged-in indicator */}
            {loggedInAs && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, fontSize: 12, color: "#6b7280" }}>
                <span>Logged in as <strong>{loggedInAs}</strong></span>
                <button onClick={logout} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 12 }}>Log out</button>
              </div>
            )}

            {/* Existing data summary — quiet, one line */}
            {existingFacts.length > 0 && (
              <div style={{ padding: "8px 12px", background: "#f0fdf4", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#374151" }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: confirmedCount > 0 ? "#34d399" : "#fbbf24", marginRight: 6, verticalAlign: "middle" }} />
                {confirmedCount > 0 ? `${confirmedCount} field${confirmedCount > 1 ? "s" : ""} verified` : ""}
                {confirmedCount > 0 && aiCount > 0 ? ", " : ""}
                {aiCount > 0 ? `${aiCount} AI estimate${aiCount > 1 ? "s" : ""}` : ""}
                {confirmedCount === 0 && aiCount === 0 ? `${existingFacts.length} fields recorded` : ""}
              </div>
            )}
            {/* Accessibility fields */}
            <div className="card">
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Accessibility Audit</h2>
              <p style={{ fontSize: 13, color: "#6b7280" }}>
                Fill in what you can observe on-site. Leave unknown fields blank.
              </p>

              {/* Toggles */}
              <div style={{ marginTop: 16 }}>
                {FIELDS.filter((f) => f.type === "toggle").map((field) => {
                  const existing = existingByField[field.name];
                  return (
                    <div className="toggle-row" key={field.name}>
                      <div>
                        <span className="toggle-label">{field.label}</span>
                        {existing && (
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                            Previously: {existing.value}
                          </div>
                        )}
                      </div>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={values[field.name] === "yes"}
                          onChange={(e) => setValue(field.name, e.target.checked ? "yes" : "no")}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </div>
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
                      {field.unit && <span style={{ fontWeight: 400, color: "#9ca3af" }}> ({field.unit})</span>}
                    </label>
                    {existing && (
                      <p style={{ fontSize: 11, color: "#9ca3af", marginTop: -2, marginBottom: 4 }}>
                        Previously: {existing.value}
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
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
                Attach evidence photos. Stored securely on the node.
              </p>
              {photos.length < 3 && (
                <label
                  htmlFor="photos"
                  style={{
                    display: "block", textAlign: "center", padding: "20px",
                    border: "2px dashed #d1d5db", borderRadius: 10,
                    color: "#6b7280", cursor: "pointer", fontSize: 14,
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
                      onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                      style={{
                        position: "absolute", top: -6, right: -6,
                        background: "#ef4444", color: "#fff",
                        border: "none", borderRadius: "50%",
                        width: 20, height: 20, cursor: "pointer", fontSize: 12,
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>

            {status === "error" && <p className="status-err">⚠️ {errorMsg}</p>}

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
