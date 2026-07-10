"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TierBadge, useLocale } from "@wikitraveler/ui";
import { AccessToolbar } from "../../AccessToolbar";
import { ReportIssueForm } from "../../components/ReportIssueForm";
import { HistoryBackButton } from "../../lib/historyBack";
import {
  fetchPropertyAccessibility,
  fetchPropertySignals,
  ENV_NODE_URL,
  type AuditPhotosPayload,
} from "../../lib/accessApi";
import { auditHref } from "../../lib/auditHref";
import { propertyHref } from "../../lib/propertyHref";
import { resolveFactDisplay, getTierLabel } from "../../lib/factDisplay";
import { readAuthToken } from "../../lib/authStorage";
import { roleFromToken, canContribute } from "../../lib/userRole";
import { toggleSavedPlace, isPlaceSaved } from "../../lib/savedPlaces";
import { cachePropertyDetail, readCachedPropertyDetail } from "../../lib/offlineCache";
import {
  groupFactsBySection,
  photosForFact,
  unassignedPhotos,
  type DisplayFact,
} from "../../lib/propertyFacts";

interface Props {
  propertyId: string;
  initialNodeUrl?: string;
}

function PhotoStrip({
  photos,
  label,
}: {
  photos: Array<{ url: string; caption: string | null }>;
  label?: string;
}) {
  if (photos.length === 0) return null;
  return (
    <div className="fk-property-photos" aria-label={label}>
      {photos.map((photo, i) => (
        <figure key={`${photo.url}-${i}`} className="fk-property-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={photo.caption ?? label ?? ""} loading="lazy" />
          {photo.caption && <figcaption>{photo.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
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
    if (!reportOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReportOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [reportOpen]);

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
          locale,
          fetchedAt: new Date().toISOString(),
          payload: access,
        });
        setSaved(isPlaceSaved(access.property.id));
      } catch {
        if (cancelled) return;
        const cached = readCachedPropertyDetail(propertyId, locale);
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
    setLoading(true);
    setError("");
    setOffline(false);
    try {
      const [access, signals] = await Promise.all([
        fetchPropertyAccessibility(targetNodeUrl, propertyId, locale),
        fetchPropertySignals(targetNodeUrl, propertyId).catch(() => ({
          openCount: 0,
          signals: [],
        })),
      ]);
      setData(access);
      setOpenCount(signals.openCount);
      cachePropertyDetail({
        propertyId,
        locale,
        fetchedAt: new Date().toISOString(),
        payload: access,
      });
      setSaved(isPlaceSaved(access.property.id));
    } catch {
      const cached = readCachedPropertyDetail(propertyId, locale);
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

  const auditPhotos: AuditPhotosPayload | null = data?.auditPhotos ?? null;
  const allPhotos =
    auditPhotos?.photos.map((p) => ({
      url: p.url,
      caption: p.caption,
      fieldName: p.fieldName,
      scopeKey: p.scopeKey,
    })) ?? [];

  const heroPhotos =
    data?.property.photos?.map((p) => ({ url: p.url, caption: p.caption ?? null })) ??
    allPhotos.slice(0, 4).map((p) => ({ url: p.url, caption: p.caption }));

  const displayFacts: DisplayFact[] = (data?.facts ?? []).map((f) => ({
    fieldName: f.fieldName,
    scopeKey: f.scopeKey,
    value: f.value,
    displayValue: f.displayValue,
    tier: f.tier,
    timestamp: f.timestamp,
    valueLocale: f.valueLocale,
    machineTranslated: f.machineTranslated,
    signatureHash: f.signatureHash,
  }));

  const sections = groupFactsBySection(displayFacts);
  const orphanPhotos = unassignedPhotos(allPhotos, displayFacts);

  return (
    <div className="fk-shell">
      <AccessToolbar nodeReachable={!offline && !error ? true : error ? false : null} />
      <main className="page fk-main fk-property-detail">
        {loading && (
          <div className="fk-property-skeleton" aria-busy="true">
            <div className="fk-discovery-skeleton fk-discovery-skeleton--hero" />
            <div className="fk-discovery-skeleton fk-discovery-skeleton--card" />
            <div className="fk-discovery-skeleton fk-discovery-skeleton--card" />
          </div>
        )}
        {error && <p className="status-err">{error}</p>}
        {offline && (
          <p className="fk-chip fk-chip--warn fk-offline-banner">{t("ui.offlineCached")}</p>
        )}

        {data && (
          <>
            <div className="fk-property-lead">
              <HistoryBackButton />
              <div className="fk-property-titlerow">
                <h1 className="fk-property-title">{data.property.name}</h1>
                <div className="fk-property-title-actions">
                  <button
                    type="button"
                    className={`fk-icon-btn${saved ? " fk-icon-btn--active" : ""}`}
                    onClick={handleSave}
                    aria-pressed={saved}
                    aria-label={saved ? t("ui.savedRemove") : t("ui.savedAdd")}
                    title={saved ? t("ui.savedRemove") : t("ui.savedAdd")}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="fk-icon-btn"
                    onClick={handleShare}
                    aria-label={t("ui.share")}
                    title={t("ui.share")}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="fk-property-location">{data.property.address ?? data.property.location}</p>
              {data.property.description && (
                <p className="fk-property-description">{data.property.description}</p>
              )}
              {data.property.sourceLinks && data.property.sourceLinks.length > 0 && (
                <div className="fk-property-sources">
                  {data.property.sourceLinks.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="fk-property-source-link"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {heroPhotos.length > 0 && (
              <div className="fk-property-hero">
                <PhotoStrip photos={heroPhotos} label={t("ui.existingDataPhotos")} />
              </div>
            )}

            {data.confidenceSummary && (
              <p className="fk-property-confidence">
                {t("ui.propertyConfidenceSummary", {
                  verified: data.confidenceSummary.verifiedCount,
                  ai: data.confidenceSummary.aiGuessCount,
                  date: data.confidenceSummary.lastAuditAt
                    ? new Date(data.confidenceSummary.lastAuditAt).toLocaleDateString(locale)
                    : t("ui.unknown"),
                })}
              </p>
            )}

            {openCount > 0 && (
              <p className="fk-property-signals">{t("ui.propertyOpenSignals", { count: openCount })}</p>
            )}

            {contributor && (
              <div className="fk-property-actions">
                <Link
                  href={auditHref(data.property.id, targetNodeUrl, homeNodeUrl)}
                  className="btn-primary fk-property-verify-primary"
                >
                  {t("ui.mapViewAudit")}
                </Link>
              </div>
            )}

            {reportOpen && (
              <div
                className="fk-modal-overlay"
                role="presentation"
                onClick={() => setReportOpen(false)}
              >
                <div
                  className="fk-modal-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label={t("ui.signalReportTitle")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="fk-modal-handle" aria-hidden="true" />
                  <button
                    type="button"
                    className="fk-modal-close"
                    aria-label={t("ui.cancel")}
                    onClick={() => setReportOpen(false)}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                  <div className="fk-modal-body">
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
                </div>
              </div>
            )}

            {sections.length === 0 ? (
              <div className="fk-empty">
                <p className="fk-empty-title">{t("ui.propertyNoFacts")}</p>
                <p className="fk-empty-body">{t("ui.propertyNoFactsBody")}</p>
                <button
                  type="button"
                  className="fk-property-report-cta"
                  onClick={() => {
                    setReportField(null);
                    setReportOpen(true);
                  }}
                >
                  {t("ui.signalReportCta")}
                </button>
              </div>
            ) : (
              <div className="fk-property-sections">
                {sections.map((section) => (
                  <section key={section.id} className="fk-property-section">
                    <h2 className="fk-property-section-title">{t(section.labelKey)}</h2>
                    <ul className="fk-property-facts">
                      {section.facts.map((fact) => {
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
                        const factPhotos = photosForFact(allPhotos, fact);
                        return (
                          <li key={`${fact.scopeKey ?? "property"}-${fact.fieldName}`} className="fk-property-fact">
                            <div className="fk-property-fact-head">
                              <div>
                                <div className="fk-property-fact-label">{label}</div>
                                <div className="fk-property-fact-value">{displayValue}</div>
                                <div className="fk-property-fact-tier-hint">
                                  {getTierLabel(fact.tier, locale)}
                                </div>
                              </div>
                              <TierBadge tier={fact.tier as "OFFICIAL" | "AI_GUESS" | "VERIFIED" | "CONFIRMED"} />
                            </div>
                            {factPhotos.length > 0 && (
                              <PhotoStrip photos={factPhotos} label={label} />
                            )}
                            <button
                              type="button"
                              className="fk-property-fact-report"
                              onClick={() => {
                                setReportField({
                                  fieldName: fact.fieldName,
                                  value: fact.value,
                                  tier: fact.tier,
                                });
                                setReportOpen(true);
                              }}
                            >
                              {t("ui.signalReportField")}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
                <div className="fk-property-report-row">
                  <p className="fk-property-report-prompt">{t("ui.signalReportPrompt")}</p>
                  <button
                    type="button"
                    className="fk-property-report-cta"
                    onClick={() => {
                      setReportField(null);
                      setReportOpen(true);
                    }}
                  >
                    {t("ui.signalReportCta")}
                  </button>
                </div>
              </div>
            )}

            {orphanPhotos.length > 0 && (
              <section className="fk-property-section">
                <h2 className="fk-property-section-title">{t("ui.propertyAuditPhotos")}</h2>
                <PhotoStrip photos={orphanPhotos} label={t("ui.propertyAuditPhotos")} />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
