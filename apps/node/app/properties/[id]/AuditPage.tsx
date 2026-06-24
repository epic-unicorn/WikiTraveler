"use client";

import { useState, useEffect } from "react";
import { useLocale, ProseFactValue } from "@wikitraveler/ui";
import { formatFactValue, getSourceLabel, isProseField } from "@wikitraveler/i18n";
import { canContribute, roleFromToken } from "@/lib/userRole";

const TIER_BADGE_CLASS: Record<string, string> = {
  OFFICIAL: "wt-fact-badge--official",
  AI_GUESS: "wt-fact-badge--ai_guess",
  VERIFIED: "wt-fact-badge--verified",
  CONFIRMED: "wt-fact-badge--confirmed",
};

interface FieldDef {
  fieldName: string;
  label: string;
  unit: string | null;
  scope: string;
}

interface Fact {
  fieldName: string;
  value: string;
  displayValue?: string;
  valueLocale?: string | null;
  machineTranslated?: boolean;
  tier: string;
  sourceType: string;
  submittedBy: string | null;
  timestamp: string;
}

interface Props {
  propertyId: string;
  propertyName: string;
  initialFacts: Fact[];
}

export default function AuditPage({ propertyId, initialFacts }: Props) {
  const { locale, t, getFieldLabel, getTierLabel } = useLocale();
  const [facts, setFacts] = useState<Fact[]>(initialFacts);
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [contributor, setContributor] = useState(false);
  const [auditRows, setAuditRows] = useState<Array<{ fieldName: string; value: string }>>([
    { fieldName: "door_width_cm", value: "" },
  ]);
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "ok" | "error"; msg?: string }>({ type: "idle" });

  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)wt_token=([^;]+)/);
    if (!m) return;
    const stored = decodeURIComponent(m[1]);
    setToken(stored);
    setContributor(canContribute(roleFromToken(stored)));
  }, []);

  useEffect(() => {
    fetch(`/api/fields?locale=${locale}`)
      .then((r) => r.json())
      .then((data: { fields?: FieldDef[] }) => {
        const propertyFields = (data.fields ?? []).filter((f) => f.scope === "PROPERTY");
        setFieldDefs(propertyFields);
      })
      .catch(() => {});
  }, [locale]);

  function fieldLabel(fieldName: string): string {
    const def = fieldDefs.find((f) => f.fieldName === fieldName);
    if (def) {
      return def.unit ? `${def.label} (${def.unit})` : def.label;
    }
    return getFieldLabel(fieldName);
  }

  function formatFactDisplay(fact: Fact): string {
    const formatted = formatFactValue(fact.fieldName, fact.value, {
      locale,
      valueLocale: fact.valueLocale,
      translatedValue: fact.displayValue,
      machineTranslated: fact.machineTranslated,
    });
    return formatted.displayValue;
  }

  function isProseFact(fact: Fact): boolean {
    return isProseField(fact.fieldName);
  }

  async function getToken() {
    setStatus({ type: "loading" });
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json() as { token?: string; message?: string; role?: string };
    if (!res.ok) {
      setStatus({ type: "error", msg: data.message ?? "Auth failed" });
      return;
    }
    const role = (data.role ?? "USER").toUpperCase();
    if (!canContribute(role as "USER" | "AUDITOR" | "ADMIN")) {
      setStatus({ type: "error", msg: t("ui.authRoleRequired") });
      return;
    }
    setToken(data.token ?? null);
    setContributor(true);
    setStatus({ type: "idle" });
  }

  function addRow() {
    setAuditRows((r) => [...r, { fieldName: "notes", value: "" }]);
  }

  function removeRow(i: number) {
    setAuditRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function submitAudit() {
    if (!token) return;
    const valid = auditRows.filter((r) => r.fieldName && r.value.trim());
    if (valid.length === 0) {
      setStatus({ type: "error", msg: t("ui.addOneFact") });
      return;
    }
    setStatus({ type: "loading" });
    const res = await fetch(`/api/properties/${propertyId}/accessibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ facts: valid, locale }),
    });
    const data = await res.json() as { message?: string };
    if (!res.ok) {
      setStatus({
        type: "error",
        msg: res.status === 403 ? t("ui.authRoleRequired") : (data.message ?? "Submit failed"),
      });
      return;
    }

    const refreshed = await fetch(`/api/properties/${propertyId}/accessibility?locale=${locale}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const refreshedData = await refreshed.json() as { facts: Fact[] };
    setFacts(refreshedData.facts ?? []);
    setStatus({ type: "ok", msg: t("ui.auditSubmitted") });
    setAuditRows([{ fieldName: "door_width_cm", value: "" }]);
  }

  const selectOptions = fieldDefs.length > 0
    ? fieldDefs
    : [{ fieldName: "door_width_cm", label: getFieldLabel("door_width_cm"), unit: "cm", scope: "PROPERTY" }];

  return (
    <div>
      <p style={{ color: "var(--wt-text-muted)", fontSize: 14, marginBottom: 32 }}>
        {t("ui.propertyId")}: <code>{propertyId}</code>
      </p>

      <section style={{ marginBottom: 40 }} aria-labelledby="facts-heading">
        <h2 id="facts-heading" style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>
          {t("ui.currentFacts")}
        </h2>
        {facts.length === 0 ? (
          <p style={{ color: "var(--wt-text-muted)" }}>{t("ui.noFactsYet")}</p>
        ) : (
          <ul className="wt-facts-list" role="list">
            {facts.map((f) => (
              <li key={f.fieldName} className="wt-fact-row">
                <div className="wt-fact-row-main">
                  <span className="wt-fact-label">{fieldLabel(f.fieldName)}</span>
                  <span className="wt-fact-value">
                    {isProseFact(f) ? (
                      <ProseFactValue
                        displayValue={f.displayValue ?? formatFactDisplay(f)}
                        rawValue={f.value}
                        machineTranslated={f.machineTranslated}
                        valueLocale={f.valueLocale}
                      />
                    ) : (
                      formatFactDisplay(f)
                    )}
                  </span>
                </div>
                <div className="wt-fact-row-meta">
                  <span className={`wt-fact-badge ${TIER_BADGE_CLASS[f.tier] ?? "wt-fact-badge--official"}`}>
                    {getTierLabel(f.tier)}
                  </span>
                  <span className="wt-fact-badge wt-fact-badge--source">
                    {getSourceLabel(f.sourceType, locale)}
                  </span>
                  <time className="wt-fact-when" dateTime={f.timestamp}>
                    {new Date(f.timestamp).toLocaleDateString(locale, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!token && (
        <section
          style={{
            background: "var(--wt-bg-elevated)", border: "1px solid var(--wt-border)",
            borderRadius: 12, padding: 24, marginBottom: 24,
          }}
          aria-labelledby="auth-heading"
        >
          <h2 id="auth-heading" style={{ fontSize: 17, fontWeight: 600, marginBottom: 12 }}>
            {t("ui.authenticate")}
          </h2>
          <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginBottom: 16 }}>
            {t("ui.signInPrompt")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
            <label htmlFor="audit-auth-username" className="wt-sr-only">{t("ui.username")}</label>
            <input
              id="audit-auth-username"
              type="text"
              placeholder={t("ui.username")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              style={{ padding: "8px 12px", border: "1px solid var(--wt-border)", borderRadius: 8, fontSize: 14 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <label htmlFor="audit-auth-password" className="wt-sr-only">{t("ui.password")}</label>
              <input
                id="audit-auth-password"
                type="password"
                placeholder={t("ui.password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && getToken()}
                autoComplete="current-password"
                style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--wt-border)", borderRadius: 8, fontSize: 14 }}
              />
              <button
                type="button"
                onClick={getToken}
                disabled={status.type === "loading"}
                style={{ background: "var(--wt-bg-header)", color: "var(--wt-bg-header-contrast)", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontWeight: 600 }}
              >
                {t("ui.signIn")}
              </button>
            </div>
          </div>
          {status.type === "error" && <p role="alert" style={{ color: "var(--wt-danger)", fontSize: 13, marginTop: 8 }}>{status.msg}</p>}
        </section>
      )}

      {token && !contributor && (
        <section
          style={{
            background: "var(--wt-bg-elevated)", border: "1px solid var(--wt-border)",
            borderRadius: 12, padding: 24, marginBottom: 24,
          }}
          role="alert"
        >
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{t("ui.authRoleRequired")}</h2>
          <p style={{ fontSize: 13, color: "var(--wt-text-muted)", margin: 0 }}>
            {t("ui.authSignInSubtitle")}
          </p>
        </section>
      )}

      {token && contributor && (
        <section
          style={{
            background: "var(--wt-bg-elevated)", border: "1px solid var(--wt-border)",
            borderRadius: 12, padding: 24,
          }}
        >
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{t("ui.submitAudit")}</h2>
          <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginBottom: 20 }}>
            {t("ui.verifiedNote", { tier: getTierLabel("VERIFIED") })}
          </p>

          {auditRows.map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <label htmlFor={`audit-field-${i}`} className="wt-sr-only">{t("ui.fieldRow", { n: i + 1 })}</label>
              <select
                id={`audit-field-${i}`}
                value={row.fieldName}
                aria-label={t("ui.fieldRow", { n: i + 1 })}
                onChange={(e) =>
                  setAuditRows((rows) =>
                    rows.map((r, idx) => idx === i ? { ...r, fieldName: e.target.value } : r)
                  )
                }
                style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--wt-border)", borderRadius: 8, fontSize: 13 }}
              >
                {selectOptions.map((f) => (
                  <option key={f.fieldName} value={f.fieldName}>
                    {f.unit ? `${f.label} (${f.unit})` : f.label}
                  </option>
                ))}
              </select>
              <label htmlFor={`audit-value-${i}`} className="wt-sr-only">{t("ui.valuePlaceholder")}</label>
              <input
                id={`audit-value-${i}`}
                placeholder={t("ui.valuePlaceholder")}
                aria-label={t("ui.valuePlaceholder")}
                value={row.value}
                onChange={(e) =>
                  setAuditRows((rows) =>
                    rows.map((r, idx) => idx === i ? { ...r, value: e.target.value } : r)
                  )
                }
                style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--wt-border)", borderRadius: 8, fontSize: 13 }}
              />
              <button
                type="button"
                aria-label={t("ui.removeRow", { n: i + 1 })}
                onClick={() => removeRow(i)}
                style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", minWidth: 44, minHeight: 44 }}
              >×</button>
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              onClick={addRow}
              style={{ background: "var(--wt-bg-secondary)", border: "1px solid var(--wt-border)", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}
            >{t("ui.addField")}</button>
            <button
              type="button"
              onClick={submitAudit}
              disabled={status.type === "loading"}
              style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
            >{status.type === "loading" ? t("ui.submitting") : t("ui.submitAudit")}</button>
          </div>

          {status.type === "ok" && (
            <p role="status" style={{ color: "#059669", fontSize: 13, marginTop: 12 }}>{status.msg}</p>
          )}
          {status.type === "error" && (
            <p role="alert" style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>{status.msg}</p>
          )}
        </section>
      )}
    </div>
  );
}
