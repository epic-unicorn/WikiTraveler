"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FIELDS = [
  { name: "door_width_cm", label: "Door Width (cm)", type: "number", unit: "cm", placeholder: "e.g. 90" },
  { name: "ramp_present", label: "Ramp Present", type: "toggle" },
  { name: "elevator_present", label: "Elevator Present", type: "toggle" },
  { name: "elevator_floor_count", label: "Number of Elevator Floors", type: "number", placeholder: "e.g. 5" },
  { name: "step_free_entrance", label: "Step-Free Entrance", type: "toggle" },
  { name: "accessible_bathroom", label: "Accessible Bathroom", type: "toggle" },
  { name: "hearing_loop", label: "Hearing Loop Installed", type: "toggle" },
  { name: "braille_signage", label: "Braille Signage", type: "toggle" },
  { name: "parking_accessible", label: "Accessible Parking", type: "toggle" },
  { name: "quiet_hours_start", label: "Quiet Hours Start", type: "time" },
  { name: "quiet_hours_end", label: "Quiet Hours End", type: "time" },
  { name: "notes", label: "Additional Notes", type: "textarea", placeholder: "Any extra details…" },
] as const;

interface Props {
  propertyId: string;
  propertyName: string;
  location: string;
}

export default function FieldAuditForm({ propertyId, propertyName, location }: Props) {
  const router = useRouter();
  const nodeUrl = process.env.NEXT_PUBLIC_NODE_API_URL ?? "http://localhost:3000";

  const [passphrase, setPassphrase] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState("");

  const [values, setValues] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function setValue(name: string, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  async function authenticate() {
    setAuthError("");
    const res = await fetch(`${nodeUrl}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase }),
    });
    const data = await res.json() as { token?: string; message?: string };
    if (!res.ok) { setAuthError(data.message ?? "Invalid passphrase"); return; }
    setToken(data.token ?? null);
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
    const res = await fetch(`${nodeUrl}/api/properties/${encodeURIComponent(propertyId)}/accessibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ facts, photoUrls: photos }),
    });

    if (res.ok) {
      setStatus("ok");
    } else {
      const d = await res.json() as { message?: string };
      setErrorMsg(d.message ?? "Submission failed");
      setStatus("error");
    }
  }

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
              Your audit for <strong>{propertyName}</strong> has been recorded as{" "}
              <span className="badge" style={{ background: "#34d399" }}>Community Verified</span>
            </p>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>
              View it live on the node:
              <br />
              <a
                href={`${nodeUrl}/properties/${propertyId}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#1e3a5f", fontWeight: 600 }}
              >
                {nodeUrl}/properties/{propertyId}
              </a>
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
          style={{ background: "none", border: "none", color: "#93c5fd", fontSize: 20, cursor: "pointer" }}
        >←</button>
        <h1 style={{ fontSize: 16 }}>{propertyName}</h1>
      </header>

      <main className="page">
        <p style={{ marginTop: 16, fontSize: 13, color: "#6b7280" }}>📍 {location}</p>

        {/* Auth gate */}
        {!token ? (
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Authenticate</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
              Enter the community passphrase to submit.
            </p>
            <label htmlFor="pass">Passphrase</label>
            <input
              id="pass"
              type="password"
              placeholder="community passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && authenticate()}
            />
            {authError && <p className="status-err">{authError}</p>}
            <button className="btn-primary" onClick={authenticate}>Continue</button>
          </div>
        ) : (
          <>
            {/* Accessibility fields */}
            <div className="card">
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Accessibility Audit</h2>
              <p style={{ fontSize: 13, color: "#6b7280" }}>
                Fill in what you can observe on-site. Leave unknown fields blank.
              </p>

              {/* Toggles */}
              <div style={{ marginTop: 16 }}>
                {FIELDS.filter((f) => f.type === "toggle").map((field) => (
                  <div className="toggle-row" key={field.name}>
                    <span className="toggle-label">{field.label}</span>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={values[field.name] === "yes"}
                        onChange={(e) => setValue(field.name, e.target.checked ? "yes" : "no")}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                ))}
              </div>

              {/* Numeric & text inputs */}
              {FIELDS.filter((f) => f.type !== "toggle").map((field) => (
                <div key={field.name}>
                  <label htmlFor={field.name}>{field.label}</label>
                  {field.type === "textarea" ? (
                    <textarea
                      id={field.name}
                      placeholder={"placeholder" in field ? field.placeholder : ""}
                      value={values[field.name] ?? ""}
                      onChange={(e) => setValue(field.name, e.target.value)}
                    />
                  ) : (
                    <input
                      id={field.name}
                      type={field.type}
                      placeholder={"placeholder" in field ? field.placeholder : ""}
                      value={values[field.name] ?? ""}
                      onChange={(e) => setValue(field.name, e.target.value)}
                    />
                  )}
                </div>
              ))}
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
