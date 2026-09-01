"use client";

import { useCallback, useEffect, useState } from "react";
import { ProseFactValue, useLocale } from "@wikitraveler/ui";
import { formatFactValue, getSourceLabel, isProseField } from "@wikitraveler/i18n";
import { factKey } from "@wikitraveler/core";
import { canContribute, roleFromToken, decodeJwtPayload } from "@/lib/userRole";
import { readNodeClientToken } from "@/lib/clientAuthToken";
import { groupFactsBySection, type DisplayFact } from "@/lib/propertyFacts";
import { AuditWizard } from "./audit/AuditWizard";
import { type ExistingFact } from "./audit/ExistingDataPanel";
import "../../node-audit.css";

const TIER_BADGE_CLASS: Record<string, string> = {
  OFFICIAL: "wt-fact-badge--official",
  AI_GUESS: "wt-fact-badge--ai_guess",
  VERIFIED: "wt-fact-badge--verified",
  CONFIRMED: "wt-fact-badge--confirmed",
};

type TabId = "facts" | "audit" | "history" | "danger";

type FieldDef = {
  fieldName: string;
  label: string;
  unit: string | null;
  scope: string;
  valueType: string;
  enumValues?: string[];
};

type SubmissionRow = {
  id: string;
  createdAt: string;
  auditorToken: string | null;
  factCount: number;
  photoCount: number;
};

type AccessibilityPayload = {
  facts: ExistingFact[];
  auditPhotos?: {
    photos: Array<{ url: string; caption: string | null; scopeKey: string | null }>;
  } | null;
  auditSubmissions?: SubmissionRow[];
};

interface Props {
  propertyId: string;
  propertyName: string;
}

export default function AuditPage({ propertyId, propertyName }: Props) {
  const { locale, t, getFieldLabel, getTierLabel } = useLocale();
  const [tab, setTab] = useState<TabId>("facts");
  const [token, setToken] = useState<string | null>(null);
  const [contributor, setContributor] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [payload, setPayload] = useState<AccessibilityPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "idle" | "error" | "ok"; msg?: string }>({ type: "idle" });
  const [wipeConfirm, setWipeConfirm] = useState("");

  function canDeleteSubmission(sub: SubmissionRow): boolean {
    if (!token) return false;
    if (roleFromToken(token) === "ADMIN") return true;
    const username = (decodeJwtPayload(token)?.sub as string | undefined)?.toLowerCase();
    if (!username || !sub.auditorToken) return false;
    return sub.auditorToken === username || sub.auditorToken.startsWith(`${username}@`);
  }

  const refresh = useCallback(async () => {
    const auth = token ?? readNodeClientToken();
    if (!auth) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}/accessibility?locale=${locale}`, {
        headers: { Authorization: `Bearer ${auth}` },
      });
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as AccessibilityPayload;
      setPayload(data);
    } catch {
      setStatus({ type: "error", msg: t("ui.signalsLoadFailed") });
    } finally {
      setLoading(false);
    }
  }, [propertyId, locale, token, t]);

  useEffect(() => {
    const stored = readNodeClientToken();
    if (stored) {
      setToken(stored);
      setContributor(canContribute(roleFromToken(stored)));
    }
  }, []);

  useEffect(() => {
    fetch(`/api/fields?locale=${locale}`)
      .then((r) => r.json())
      .then((data: { fields?: FieldDef[] }) => setFieldDefs(data.fields ?? []))
      .catch(() => {});
  }, [locale]);

  useEffect(() => {
    if (token && contributor) void refresh();
  }, [token, contributor, refresh]);

  async function login() {
    setStatus({ type: "idle" });
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
    if (data.token) {
      document.cookie = `wt_token=${encodeURIComponent(data.token)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      sessionStorage.setItem("wt_node_token", data.token);
      setToken(data.token);
      setContributor(true);
    }
  }

  async function deleteSubmission(id: string) {
    if (!token || !window.confirm(t("ui.nodeAuditDeleteConfirm"))) return;
    const res = await fetch(`/api/admin/audit-submissions/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json() as { message?: string };
      setStatus({ type: "error", msg: data.message ?? t("ui.signalsUpdateFailed") });
      return;
    }
    await refresh();
    setStatus({ type: "ok", msg: t("ui.nodeAuditDeleted") });
  }

  async function wipeAllAudits() {
    if (!token) return;
    const res = await fetch(
      `/api/properties/${propertyId}/audits?confirm=${encodeURIComponent(wipeConfirm)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json() as { message?: string };
    if (!res.ok) {
      setStatus({ type: "error", msg: data.message ?? t("ui.loadFailed") });
      return;
    }
    setWipeConfirm("");
    await refresh();
    setStatus({ type: "ok", msg: t("ui.nodeAuditWiped") });
  }

  const facts = payload?.facts ?? [];
  const photos = payload?.auditPhotos?.photos ?? [];
  const submissions = payload?.auditSubmissions ?? [];

  function fieldLabel(fieldName: string, scopeKey?: string): string {
    const def = fieldDefs.find((f) => f.fieldName === fieldName);
    const base = def ? (def.unit ? `${def.label} (${def.unit})` : def.label) : getFieldLabel(fieldName);
    if (scopeKey?.startsWith("room-type:")) {
      return `${base} · ${scopeKey.replace("room-type:", "")}`;
    }
    return base;
  }

  function formatFactDisplay(fact: ExistingFact): string {
    return formatFactValue(fact.fieldName, fact.value, {
      locale,
      valueLocale: fact.valueLocale,
      translatedValue: fact.displayValue,
      machineTranslated: fact.machineTranslated,
    }).displayValue;
  }

  const displayFacts: DisplayFact[] = facts.map((f) => ({
    fieldName: f.fieldName,
    scopeKey: (f as ExistingFact & { scopeKey?: string }).scopeKey,
    value: f.value,
    displayValue: f.displayValue,
    tier: f.tier,
    valueLocale: f.valueLocale,
    machineTranslated: f.machineTranslated,
  }));

  const sections = groupFactsBySection(displayFacts);
  const isAdmin = token ? roleFromToken(token) === "ADMIN" : false;

  const tabs: { id: TabId; label: string }[] = [
    { id: "facts", label: t("ui.currentFacts") },
    { id: "audit", label: t("ui.submitAudit") },
    { id: "history", label: t("ui.nodeAuditTabHistory") },
    ...(isAdmin ? [{ id: "danger" as const, label: t("ui.nodeAuditTabDanger") }] : []),
  ];

  return (
    <div className="wt-node-audit">
      <nav className="wt-node-audit-tabs" aria-label={t("ui.submitAudit")}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "wt-node-audit-tabs__btn is-active" : "wt-node-audit-tabs__btn"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {status.type !== "idle" && status.msg && (
        <p
          role={status.type === "error" ? "alert" : "status"}
          className={`wt-node-audit-status wt-node-audit-status--${status.type}`}
        >
          {status.msg}
        </p>
      )}

      {!token && (
        <section className="card wt-node-audit-auth">
          <h2 className="wt-node-audit-auth__title">{t("ui.authenticate")}</h2>
          <div className="wt-node-audit-auth__form">
            <input type="text" placeholder={t("ui.username")} value={username} onChange={(e) => setUsername(e.target.value)} />
            <input type="password" placeholder={t("ui.password")} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="btn-primary" onClick={() => void login()}>{t("ui.signIn")}</button>
          </div>
        </section>
      )}

      {token && !contributor && (
        <p role="alert" style={{ marginTop: 16, color: "var(--wt-danger)" }}>{t("ui.authRoleRequired")}</p>
      )}

      {token && contributor && tab === "facts" && (
        <section style={{ marginTop: 16 }}>
          {loading && <p style={{ color: "var(--wt-text-muted)" }}>{t("ui.loading")}</p>}
          {!loading && sections.length === 0 && (
            <p style={{ color: "var(--wt-text-muted)" }}>{t("ui.noFactsYet")}</p>
          )}
          {sections.map((section) => (
            <div key={section.id} style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{t(section.labelKey)}</h3>
              <ul className="wt-facts-list" role="list">
                {section.facts.map((f) => (
                  <li key={factKey({ fieldName: f.fieldName, scopeKey: f.scopeKey ?? "property" })} className="wt-fact-row">
                    <div className="wt-fact-row-main">
                      <span className="wt-fact-label">{fieldLabel(f.fieldName, f.scopeKey)}</span>
                      <span className="wt-fact-value">
                        {isProseField(f.fieldName) ? (
                          <ProseFactValue
                            displayValue={f.displayValue ?? formatFactDisplay(f as ExistingFact)}
                            rawValue={f.value}
                            machineTranslated={f.machineTranslated}
                            valueLocale={f.valueLocale}
                          />
                        ) : (
                          formatFactDisplay(f as ExistingFact)
                        )}
                      </span>
                    </div>
                    <div className="wt-fact-row-meta">
                      <span className={`wt-fact-badge ${TIER_BADGE_CLASS[f.tier] ?? "wt-fact-badge--official"}`}>
                        {getTierLabel(f.tier)}
                      </span>
                      <span className="wt-fact-badge wt-fact-badge--source">
                        {getSourceLabel((f as ExistingFact).sourceType ?? "AUDITOR", locale)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {photos.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{t("ui.existingDataPhotos")}</h3>
              <div className="wt-node-audit-photo-grid">
                {photos.map((p) => (
                  <figure key={p.url}>
                    <img src={p.url} alt={p.caption ?? ""} />
                    {p.scopeKey && <figcaption>{p.scopeKey}</figcaption>}
                  </figure>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {token && contributor && tab === "audit" && (
        <div style={{ marginTop: 16 }}>
          <AuditWizard
            propertyId={propertyId}
            token={token}
            locale={locale}
            fieldDefs={fieldDefs}
            loadedFacts={facts}
            existingPhotos={photos}
            onSuccess={() => {
              void refresh();
              setTab("facts");
              setStatus({ type: "ok", msg: t("ui.auditSubmitted") });
            }}
            onCancel={() => setTab("facts")}
            onError={(msg) => setStatus({ type: "error", msg })}
            t={t}
            getTierLabel={getTierLabel}
          />
        </div>
      )}

      {token && contributor && tab === "history" && (
        <section style={{ marginTop: 16 }}>
          {submissions.length === 0 ? (
            <p style={{ color: "var(--wt-text-muted)" }}>{t("ui.nodeAuditNoHistory")}</p>
          ) : (
            <ul className="wt-node-audit-history">
              {submissions.map((s) => {
                const canDelete = canDeleteSubmission(s);
                return (
                  <li key={s.id} className="card wt-node-audit-history__item">
                    <div className="wt-node-audit-history__row">
                      <div>
                        <strong style={{ fontSize: 14 }}>{new Date(s.createdAt).toLocaleString(locale)}</strong>
                        <p className="wt-node-audit-history__meta">
                          {s.auditorToken ?? "—"} · {s.factCount} {t("ui.nodeAuditFacts")} · {s.photoCount} {t("ui.existingDataPhotos")}
                        </p>
                      </div>
                      {canDelete && (
                        <button type="button" className="btn-secondary" onClick={() => void deleteSubmission(s.id)}>
                          {t("ui.nodeAuditDeleteSubmission")}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {token && contributor && isAdmin && tab === "danger" && (
        <section className="card wt-node-audit-danger">
          <h2 className="wt-node-audit-danger__title">{t("ui.nodeAuditTabDanger")}</h2>
          <p className="wt-node-audit-danger__hint">
            {t("ui.nodeAuditWipeHint", { name: propertyName })}
          </p>
          <div className="wt-node-audit-danger__form">
            <input
              type="text"
              className="wt-node-audit-danger__input"
              value={wipeConfirm}
              onChange={(e) => setWipeConfirm(e.target.value)}
              placeholder={propertyName}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={wipeConfirm !== propertyName}
              onClick={() => void wipeAllAudits()}
            >
              {t("ui.nodeAuditWipeAll")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
