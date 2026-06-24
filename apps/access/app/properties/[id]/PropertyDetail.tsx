"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TierBadge, useLocale } from "@wikitraveler/ui";
import { AccessToolbar } from "../../AccessToolbar";
import { ReportIssueForm } from "../../components/ReportIssueForm";
import {
  fetchPropertyAccessibility,
  fetchPropertySignals,
  ENV_NODE_URL,
} from "../../lib/accessApi";
import { auditHref } from "../../lib/auditHref";
import { propertyHref } from "../../lib/propertyHref";
import { resolveFactDisplay } from "../../lib/factDisplay";
import { readAuthToken } from "../../lib/authStorage";
import { roleFromToken, canContribute } from "../../lib/userRole";
import { toggleSavedPlace, isPlaceSaved } from "../../lib/savedPlaces";
import { cachePropertyDetail, readCachedPropertyDetail } from "../../lib/offlineCache";

interface Props {
  propertyId: string;
  initialNodeUrl?: string;
}

export function PropertyDetail({ propertyId, initialNodeUrl }: Props) {
  const { locale, t } = useLocale();
  const searchParams = useSearchParams();
  const nodeParam = searchParams.get("node");
  const homeNodeUrl = initialNodeUrl ?? ENV_NODE_URL;
  const targetNodeUrl = nodeParam ?? homeNodeUrl;

  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPropertyAccessibility>> | null>(null);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportField, setReportField] = useState<{
    fieldName: string;
    value: string;
    tier: string;
  } | null>(null);
  const [offline, setOffline] = useState(false);

  const role = roleFromToken(readAuthToken());
  const contributor = canContribute(role);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setOffline(false);
      try {
        const [access, signals] = await Promise.all([
          fetchPropertyAccessibility(targetNodeUrl, propertyId, locale, controller.signal),
          fetchPropertySignals(targetNodeUrl, propertyId, controller.signal).catch(() => ({
            openCount: 0,
            signals: [],
          })),
        ]);
        if (cancelled) return;
        setData(access);
        setOpenCount(signals.openCount);
        cachePropertyDetail({
          propertyId,
          nodeUrl: targetNodeUrl,
          locale,
          fetchedAt: new Date().toISOString(),
          payload: access,
        });
        setSaved(isPlaceSaved(access.property.id));
      } catch {
        if (cancelled) return;
        const cached = readCachedPropertyDetail(propertyId, targetNodeUrl, locale);
        if (cached?.payload) {
          setData(cached.payload as Awaited<ReturnType<typeof fetchPropertyAccessibility>>);
          setOffline(true);
        } else {
          setError(t("ui.propertyLoadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [targetNodeUrl, propertyId, locale, t]);

  async function reload() {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setOffline(false);
    try {
      const [access, signals] = await Promise.all([
        fetchPropertyAccessibility(targetNodeUrl, propertyId, locale, controller.signal),
        fetchPropertySignals(targetNodeUrl, propertyId, controller.signal).catch(() => ({
          openCount: 0,
          signals: [],
        })),
      ]);
      setData(access);
      setOpenCount(signals.openCount);
      cachePropertyDetail({
        propertyId,
        nodeUrl: targetNodeUrl,
        locale,
        fetchedAt: new Date().toISOString(),
        payload: access,
      });
      setSaved(isPlaceSaved(access.property.id));
    } catch {
      const cached = readCachedPropertyDetail(propertyId, targetNodeUrl, locale);
      if (cached?.payload) {
        setData(cached.payload as Awaited<ReturnType<typeof fetchPropertyAccessibility>>);
        setOffline(true);
      } else {
        setError(t("ui.propertyLoadFailed"));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    if (!data?.property) return;
    const url = `${window.location.origin}${propertyHref(data.property.id, targetNodeUrl, homeNodeUrl)}`;
    const text = `${data.property.name} — WikiTraveler Access`;
    if (navigator.share) {
      try {
        await navigator.share({ title: text, url });
        return;
      } catch {
        // fall through
      }
    }
    await navigator.clipboard.writeText(url);
    alert(t("ui.shareLinkCopied"));
  }

  function handleSave() {
    if (!data?.property) return;
    const nowSaved = toggleSavedPlace({
      id: data.property.id,
      name: data.property.name,
      location: data.property.location,
      nodeUrl: targetNodeUrl,
    });
    setSaved(nowSaved);
  }

  return (
    <div className="fk-shell">
      <AccessToolbar
        showBack
        title={data?.property.name}
        nodeReachable={!offline && !error ? true : error ? false : null}
      />
      <main className="page fk-main" style={{ padding: "16px 16px 32px" }}>
        {loading && <p className="status-muted">{t("ui.loading")}</p>}
        {error && <p className="status-err">{error}</p>}
        {offline && (
          <p className="fk-chip fk-chip--warn" style={{ marginBottom: 12 }}>{t("ui.offlineCached")}</p>
        )}

        {data && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>{data.property.name}</h1>
            <p style={{ fontSize: 13, color: "var(--wt-text-muted)", margin: "0 0 12px" }}>
              {data.property.location}
            </p>

            {openCount > 0 && (
              <p style={{ fontSize: 12, color: "var(--wt-text-muted)", marginBottom: 12 }}>
                {t("ui.propertyOpenSignals", { count: openCount })}
              </p>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <button type="button" className="btn-secondary" onClick={handleSave}>
                {saved ? t("ui.savedRemove") : t("ui.savedAdd")}
              </button>
              <button type="button" className="btn-secondary" onClick={handleShare}>
                {t("ui.share")}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setReportField(null);
                  setReportOpen(true);
                }}
              >
                {t("ui.signalReportCta")}
              </button>
              {contributor && (
                <Link
                  href={auditHref(data.property.id, targetNodeUrl, homeNodeUrl)}
                  className="btn-primary"
                  style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                >
                  {t("ui.verifyAccess")}
                </Link>
              )}
            </div>

            {reportOpen && (
              <div style={{ marginBottom: 20 }}>
                <ReportIssueForm
                  propertyId={data.property.id}
                  nodeUrl={targetNodeUrl}
                  fieldName={reportField?.fieldName}
                  currentValue={reportField?.value}
                  currentTier={reportField?.tier}
                  onSubmitted={() => {
                    setReportOpen(false);
                    reload();
                  }}
                  onCancel={() => setReportOpen(false)}
                />
              </div>
            )}

            {data.facts.length === 0 ? (
              <div className="fk-empty">
                <p className="fk-empty-title">{t("ui.propertyNoFacts")}</p>
                <p className="fk-empty-body">{t("ui.propertyNoFactsBody")}</p>
              </div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                {data.facts.map((fact) => {
                  const { label, displayValue } = resolveFactDisplay(
                    {
                      fieldName: fact.fieldName,
                      value: fact.value,
                      tier: fact.tier,
                      valueLocale: fact.valueLocale,
                      translatedValue:
                        fact.machineTranslated && fact.displayValue ? fact.displayValue : undefined,
                      machineTranslated: fact.machineTranslated,
                    },
                    locale
                  );
                  return (
                    <li
                      key={`${fact.scopeKey ?? "property"}-${fact.fieldName}`}
                      style={{
                        border: "1px solid var(--wt-border)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        background: "var(--wt-bg-elevated)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 12, color: "var(--wt-text-muted)" }}>{label}</div>
                          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{displayValue}</div>
                        </div>
                        <TierBadge tier={fact.tier as "OFFICIAL" | "AI_GUESS" | "VERIFIED" | "CONFIRMED"} />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setReportField({
                            fieldName: fact.fieldName,
                            value: fact.value,
                            tier: fact.tier,
                          });
                          setReportOpen(true);
                        }}
                        style={{
                          marginTop: 8,
                          background: "none",
                          border: "none",
                          padding: 0,
                          fontSize: 12,
                          color: "var(--wt-primary)",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {t("ui.signalReportField")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
