"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@wikitraveler/ui";
import { ReportIssueForm } from "../../components/ReportIssueForm";
import { useHistoryBack } from "../../lib/historyBack";
import {
  fetchPropertyAccessibility,
  fetchPropertySignals,
  ENV_NODE_URL,
  type AuditNoteEntry,
  type AuditPhotosPayload,
} from "../../lib/accessApi";
import { auditHref } from "../../lib/auditHref";
import { propertyHref } from "../../lib/propertyHref";
import { getRoomTypeLabel } from "@wikitraveler/i18n";
import { resolveFactDisplay, getTierLabel } from "../../lib/factDisplay";
import { readAuthToken } from "../../lib/authStorage";
import { roleFromToken, canContribute } from "../../lib/userRole";
import { toggleSavedPlace, isPlaceSaved } from "../../lib/savedPlaces";
import { inferSavedCategory } from "../../lib/savedCategory";
import { cachePropertyDetail, readCachedPropertyDetail } from "../../lib/offlineCache";
import {
  groupFactsBySection,
  photosForFact,
  photosForSection,
  photosForRoomScope,
  splitRoomSectionFacts,
  unassignedPhotos,
  type DisplayFact,
  type FactSection,
} from "../../lib/propertyFacts";
import { AccessibilityIconRow } from "../../components/AccessibilityIconRow";
import { PropertyMiniMap } from "../../components/PropertyMiniMap";
import { TaggedNotes } from "../../components/TaggedNotes";
import { AuditNotesList } from "../../components/AuditNotesList";
import { PhotoLightbox } from "../../components/PhotoLightbox";
import { parseTaggedNotes } from "../../lib/taggedNotes";

interface Props {
  propertyId: string;
  initialNodeUrl?: string;
}

/** Expected field counts for category fill bars (matches SECTION_RULES). */
const CATEGORY_EXPECTED: Array<{
  id: string;
  labelKey: string;
  sectionIds: string[];
  expected: number;
}> = [
  { id: "mobility", labelKey: "ui.auditStepMobility", sectionIds: ["entrance", "mobility"], expected: 11 },
  { id: "room", labelKey: "ui.auditStepRoom", sectionIds: ["room"], expected: 7 },
  { id: "bathroom", labelKey: "ui.auditStepBathroom", sectionIds: ["bathroom"], expected: 3 },
  { id: "communication", labelKey: "ui.auditStepCommunication", sectionIds: ["communication"], expected: 5 },
];

function FactList({
  facts,
  allPhotos,
  locale,
  t,
  onReport,
  openPhoto,
}: {
  facts: DisplayFact[];
  allPhotos: Array<{
    url: string;
    caption: string | null;
    fieldName?: string | null;
    scopeKey?: string | null;
  }>;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  onReport: (fact: DisplayFact) => void;
  openPhoto: (url: string) => void;
}) {
  if (facts.length === 0) return null;
  return (
    <ul className="fk-property-facts">
      {facts.map((fact) => {
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
          <li
            key={`${fact.scopeKey ?? "property"}-${fact.fieldName}`}
            className={`fk-property-fact${fact.fieldName === "notes" ? " fk-property-fact--notes" : ""}`}
          >
            <div className="fk-property-fact-row">
              <span className="fk-property-fact-label">{label}</span>
              {fact.fieldName === "notes" ? (
                <TaggedNotes text={displayValue} />
              ) : (
                <span className="fk-property-fact-value">{displayValue}</span>
              )}
            </div>
            <div className="fk-property-fact-meta">
              <span className="fk-property-fact-tier">{getTierLabel(fact.tier, locale)}</span>
              <button
                type="button"
                className="fk-property-fact-report"
                onClick={() => onReport(fact)}
              >
                {t("ui.signalReportField")}
              </button>
            </div>
            {factPhotos.length > 0 && (
              <PhotoStrip
                photos={factPhotos}
                label={label}
                openLabel={t("ui.propertyOpenPhoto")}
                onOpen={openPhoto}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function uniqueGallery(
  photos: Array<{ url: string; caption: string | null }>
): Array<{ url: string; caption: string | null }> {
  const seen = new Set<string>();
  const out: Array<{ url: string; caption: string | null }> = [];
  for (const photo of photos) {
    if (!photo.url || seen.has(photo.url)) continue;
    seen.add(photo.url);
    out.push(photo);
  }
  return out;
}

function notesFromResponse(
  notes: AuditNoteEntry[] | undefined,
  facts: Array<{
    fieldName: string;
    value: string;
    displayValue?: string;
    timestamp?: string;
    valueLocale?: string | null;
    machineTranslated?: boolean;
  }>
): AuditNoteEntry[] {
  if (notes && notes.length > 0) return notes;
  const fact = facts.find((f) => f.fieldName === "notes" && f.value.trim());
  if (!fact) return [];
  const displayText = fact.displayValue ?? fact.value;
  return [
    {
      submissionId: "legacy-notes",
      createdAt: fact.timestamp ?? new Date().toISOString(),
      auditorToken: null,
      text: fact.value,
      displayText,
      sourceLocale: fact.valueLocale ?? null,
      machineTranslated: fact.machineTranslated,
    },
  ];
}

function PhotoStrip({
  photos,
  label,
  openLabel,
  onOpen,
}: {
  photos: Array<{ url: string; caption: string | null }>;
  label?: string;
  openLabel: string;
  onOpen: (url: string) => void;
}) {
  if (photos.length === 0) return null;
  return (
    <div className="fk-property-photos" aria-label={label}>
      {photos.map((photo, i) => (
        <figure key={`${photo.url}-${i}`} className="fk-property-photo">
          <button
            type="button"
            className="fk-property-photo-btn"
            onClick={() => onOpen(photo.url)}
            aria-label={openLabel}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={photo.caption ?? label ?? ""} />
          </button>
          {photo.caption && <figcaption>{photo.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

function HeroCarousel({
  photos,
  name,
  onOpen,
}: {
  photos: Array<{ url: string; caption: string | null }>;
  name: string;
  onOpen: (url: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const photoKey = photos.map((p) => p.url).join("|");

  useEffect(() => {
    setIndex(0);
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [photoKey]);

  function syncIndex() {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    setIndex(Math.min(photos.length - 1, Math.max(0, next)));
  }

  function go(next: number) {
    const clamped = Math.min(photos.length - 1, Math.max(0, next));
    setIndex(clamped);
    const child = scrollerRef.current?.children[clamped] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  if (photos.length === 0) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="fk-property-hero-img fk-property-hero-img--placeholder"
        src="/images/property-hero-placeholder.svg"
        alt=""
        aria-hidden="true"
      />
    );
  }

  return (
    <>
      <div
        ref={scrollerRef}
        className="fk-property-hero-scroller"
        role="group"
        aria-roledescription="carousel"
        aria-label={name}
        tabIndex={photos.length > 1 ? 0 : undefined}
        onScroll={syncIndex}
        onKeyDown={(e) => {
          if (photos.length <= 1) return;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(index - 1);
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            go(index + 1);
          }
        }}
      >
        {photos.map((photo, i) => (
          <button
            key={`${photo.url}-${i}`}
            type="button"
            className="fk-property-hero-slide"
            onClick={() => onOpen(photo.url)}
            aria-label={photo.caption ?? name}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="fk-property-hero-img fk-property-hero-img--open"
              src={photo.url}
              alt={photo.caption ?? name}
              draggable={false}
            />
          </button>
        ))}
      </div>
      {photos.length > 1 && (
        <span className="fk-property-hero-counter" aria-live="polite">
          {index + 1} / {photos.length}
        </span>
      )}
    </>
  );
}

function categoryBars(sections: FactSection[]): Array<{ id: string; labelKey: string; pct: number; count: number }> {
  return CATEGORY_EXPECTED.map((cat) => {
    const count = sections
      .filter((s) => cat.sectionIds.includes(s.id))
      .reduce((sum, s) => sum + s.facts.length, 0);
    const pct = Math.min(100, Math.round((count / cat.expected) * 100));
    return { id: cat.id, labelKey: cat.labelKey, pct, count };
  });
}

/** Overall score = expected-field-weighted coverage across categories (0–100). */
function overallAccessibilityScore(
  bars: Array<{ pct: number }>
): number | null {
  let weighted = 0;
  let expected = 0;
  for (let i = 0; i < CATEGORY_EXPECTED.length; i++) {
    const bar = bars[i];
    if (!bar) continue;
    weighted += bar.pct * CATEGORY_EXPECTED[i].expected;
    expected += CATEGORY_EXPECTED[i].expected;
  }
  if (expected <= 0) return null;
  if (bars.every((b) => b.pct === 0)) return null;
  return Math.round(weighted / expected);
}

export function PropertyDetail({ propertyId, initialNodeUrl }: Props) {
  const { locale, t } = useLocale();
  const searchParams = useSearchParams();
  const goBack = useHistoryBack("/");
  const nodeParam = searchParams.get("node");
  const homeNodeUrl = initialNodeUrl ?? ENV_NODE_URL;
  const targetNodeUrl = nodeParam ?? homeNodeUrl;

  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPropertyAccessibility>> | null>(null);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [reportOpen, setReportOpen] = useState(() => searchParams.get("report") === "1");
  const [reportField, setReportField] = useState<{
    fieldName: string;
    value: string;
    tier: string;
  } | null>(null);
  const [offline, setOffline] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [scoreHelpOpen, setScoreHelpOpen] = useState(false);

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
        setLightboxIndex(null);
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
          setLightboxIndex(null);
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
      setLightboxIndex(null);
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

  const auditPhotos: AuditPhotosPayload | null = data?.auditPhotos ?? null;
  const allPhotos =
    auditPhotos?.photos.map((p) => ({
      url: p.url,
      caption: p.caption,
      fieldName: p.fieldName,
      scopeKey: p.scopeKey,
    })) ?? [];
  const historyPhotos =
    data?.auditPhotoHistory?.flatMap((group) =>
      group.photos.map((p) => ({
        url: p.url,
        caption: p.caption,
        fieldName: p.fieldName,
        scopeKey: p.scopeKey,
      }))
    ) ?? [];

  const heroPhotos =
    data?.property.photos?.map((p) => ({ url: p.url, caption: p.caption ?? null })) ??
    allPhotos.slice(0, 4).map((p) => ({ url: p.url, caption: p.caption }));

  const galleryPhotos = uniqueGallery([
    ...heroPhotos,
    ...allPhotos.map((p) => ({ url: p.url, caption: p.caption })),
    ...historyPhotos.map((p) => ({ url: p.url, caption: p.caption })),
  ]);

  function openPhoto(url: string) {
    const index = galleryPhotos.findIndex((p) => p.url === url);
    setLightboxIndex(index >= 0 ? index : 0);
  }

  function handleSave() {
    if (!data?.property) return;
    const nowSaved = toggleSavedPlace({
      id: data.property.id,
      name: data.property.name,
      location: data.property.location,
      nodeUrl: targetNodeUrl,
      imageUrl: heroPhotos[0]?.url ?? null,
      category: inferSavedCategory(data.property.name, data.property.location),
      facts: (data.facts ?? []).map((f) => ({ fieldName: f.fieldName, value: f.value })),
    });
    setSaved(nowSaved);
  }

  const displayFacts: DisplayFact[] = (data?.facts ?? [])
    .filter((f) => f.fieldName !== "notes")
    .map((f) => ({
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
  const hideTaggedDescription = Boolean(
    data?.property.description && parseTaggedNotes(data.property.description)
  );
  const auditNoteList = notesFromResponse(data?.auditNotes, data?.facts ?? []);
  const orphanPhotos = unassignedPhotos(allPhotos, displayFacts);
  const shownStepScopes = new Set<string>();

  const bars = categoryBars(sections);
  const accessibilityScore = overallAccessibilityScore(bars);
  const excellent = accessibilityScore != null && accessibilityScore >= 70;
  const factTotal =
    (data?.confidenceSummary?.verifiedCount ?? 0) +
    (data?.confidenceSummary?.aiGuessCount ?? 0) +
    (data?.confidenceSummary?.officialCount ?? 0);
  const factsPresent = displayFacts.length;

  const propertyLat = data?.property.lat;
  const propertyLon = data?.property.lon;
  const hasCoords =
    propertyLat != null &&
    propertyLon != null &&
    Number.isFinite(propertyLat) &&
    Number.isFinite(propertyLon) &&
    propertyLat !== 0 &&
    propertyLon !== 0;

  return (
    <div className="fk-shell">
      <main className="page fk-main fk-property-detail">
        {loading && (
          <div className="fk-property-skeleton" aria-busy="true">
            <div className="fk-discovery-skeleton fk-discovery-skeleton--hero fk-property-skeleton-hero" />
            <div className="fk-discovery-skeleton fk-discovery-skeleton--card" />
            <div className="fk-discovery-skeleton fk-discovery-skeleton--card" />
          </div>
        )}
        {error && <p className="status-err fk-property-error">{error}</p>}

        {data && (
          <div className="fk-property-layout">
            <div className={`fk-property-hero-bleed${galleryPhotos.length > 0 ? "" : " fk-property-hero-bleed--empty"}`}>
              <HeroCarousel
                photos={galleryPhotos}
                name={data.property.name}
                onOpen={openPhoto}
              />

              <div className="fk-property-hero-overlay">
                <button
                  type="button"
                  className="fk-icon-btn fk-icon-btn--overlay"
                  onClick={goBack}
                  aria-label={t("ui.back")}
                  title={t("ui.back")}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <div className="fk-property-hero-actions">
                  <button
                    type="button"
                    className={`fk-icon-btn fk-icon-btn--overlay${saved ? " fk-icon-btn--active" : ""}`}
                    onClick={handleSave}
                    aria-pressed={saved}
                    aria-label={saved ? t("ui.savedRemove") : t("ui.savedAdd")}
                    title={saved ? t("ui.savedRemove") : t("ui.savedAdd")}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="fk-icon-btn fk-icon-btn--overlay"
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
            </div>

            <div className="fk-property-sheet">
              {offline && (
                <p className="fk-chip fk-chip--warn fk-offline-banner">{t("ui.offlineCached")}</p>
              )}

              <header className="fk-property-sheet-head">
                <div className="fk-property-sheet-top">
                  <div className="fk-property-sheet-intro">
                    <div className="fk-property-sheet-title-row">
                      <h1 className="fk-property-title fk-property-title--section">{data.property.name}</h1>
                      {excellent && (
                        <span className="fk-property-badge fk-property-badge--excellent">
                          {t("ui.propertyScoreExcellent")}
                        </span>
                      )}
                    </div>
                    <p className="fk-property-location">
                      {data.property.address ?? data.property.location}
                    </p>
                    <AccessibilityIconRow facts={data.facts} withLabels />
                  </div>
                  {hasCoords && (
                    <PropertyMiniMap
                      lat={propertyLat!}
                      lon={propertyLon!}
                      name={data.property.name}
                    />
                  )}
                </div>
                {data.property.description && !hideTaggedDescription && (
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
              </header>

              {(accessibilityScore != null || bars.some((b) => b.pct > 0)) && (
                <section className="fk-property-score" aria-labelledby="fk-property-score-title">
                  <div className="fk-property-score-heading-row">
                    <h2 id="fk-property-score-title" className="fk-property-score-heading">
                      {t("ui.propertyScoreTitle")}
                    </h2>
                    <button
                      type="button"
                      className="fk-property-score-help"
                      aria-expanded={scoreHelpOpen}
                      aria-controls="fk-property-score-help"
                      aria-label={t("ui.propertyScoreHelp")}
                      title={t("ui.propertyScoreHelp")}
                      onClick={() => setScoreHelpOpen((open) => !open)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4" strokeLinecap="round" />
                        <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
                      </svg>
                    </button>
                  </div>
                  {scoreHelpOpen && (
                    <p id="fk-property-score-help" className="fk-property-score-help-body" role="note">
                      {t("ui.propertyScoreHelpBody")}
                    </p>
                  )}
                  <div className="fk-property-score-body">
                    {accessibilityScore != null && (
                      <div
                        className="fk-property-score-donut"
                        style={{ ["--fk-score-pct" as string]: accessibilityScore }}
                        role="img"
                        aria-label={`${accessibilityScore}%`}
                      >
                        <div className="fk-property-score-donut-inner">
                          <span className="fk-property-score-pct">{accessibilityScore}%</span>
                        </div>
                      </div>
                    )}
                    <div className="fk-property-score-bars">
                      {bars.map((bar) => (
                        <div key={bar.id} className="fk-property-score-bar">
                          <div className="fk-property-score-bar-meta">
                            <span>{t(bar.labelKey)}</span>
                            <span>{bar.pct}%</span>
                          </div>
                          <div className="fk-property-score-bar-track" aria-hidden="true">
                            <div
                              className="fk-property-score-bar-fill"
                              style={{ width: `${bar.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      {factsPresent > 0 && (
                        <p className="fk-property-score-based">
                          {data.confidenceSummary && factTotal > 0
                            ? t("ui.propertyScoreBasedOn", {
                                verified: data.confidenceSummary.verifiedCount,
                                total: factTotal,
                              })
                            : t("ui.propertyScoreCoverage", { count: factsPresent })}
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {data.confidenceSummary && accessibilityScore == null && factsPresent === 0 && (
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
                    className="btn-secondary fk-property-action-btn"
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
                  {sections.map((section) => {
                    const sectionPhotosRaw = photosForSection(allPhotos, section);
                    const sectionPhotos = sectionPhotosRaw.filter((p) => {
                      if (section.id === "room") return false;
                      const stepKey = p.groupKey ?? section.id;
                      if (shownStepScopes.has(stepKey)) return false;
                      shownStepScopes.add(stepKey);
                      return true;
                    });
                    const roomSplit =
                      section.id === "room" ? splitRoomSectionFacts(section.facts) : null;
                    const reportFact = (fact: DisplayFact) => {
                      setReportField({
                        fieldName: fact.fieldName,
                        value: fact.value,
                        tier: fact.tier,
                      });
                      setReportOpen(true);
                    };
                    return (
                      <section key={section.id} className="fk-property-section">
                        <h2 className="fk-property-section-title">{t(section.labelKey)}</h2>
                        {roomSplit ? (
                          <>
                            <FactList
                              facts={roomSplit.overview}
                              allPhotos={allPhotos}
                              locale={locale}
                              t={t}
                              onReport={reportFact}
                              openPhoto={openPhoto}
                            />
                            {roomSplit.groups.map((group) => {
                              const roomPhotos = photosForRoomScope(
                                allPhotos,
                                `room-type:${group.typeId}`
                              );
                              return (
                                <div key={group.typeId} className="fk-property-room-type">
                                  <p className="fk-property-room-type-kicker">
                                    {t("ui.propertyAuditedRoomType")}
                                  </p>
                                  <h3 className="fk-property-room-type-title">
                                    {getRoomTypeLabel(group.typeId, locale)}
                                  </h3>
                                  <FactList
                                    facts={group.facts}
                                    allPhotos={allPhotos}
                                    locale={locale}
                                    t={t}
                                    onReport={reportFact}
                                    openPhoto={openPhoto}
                                  />
                                  {roomPhotos.length > 0 && (
                                    <PhotoStrip
                                      photos={roomPhotos}
                                      label={getRoomTypeLabel(group.typeId, locale)}
                                      openLabel={t("ui.propertyOpenPhoto")}
                                      onOpen={openPhoto}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <>
                            <FactList
                              facts={section.facts}
                              allPhotos={allPhotos}
                              locale={locale}
                              t={t}
                              onReport={(fact) => {
                                setReportField({
                                  fieldName: fact.fieldName,
                                  value: fact.value,
                                  tier: fact.tier,
                                });
                                setReportOpen(true);
                              }}
                              openPhoto={openPhoto}
                            />
                            {sectionPhotos.length > 0 && (
                              <PhotoStrip
                                photos={sectionPhotos}
                                label={t(section.labelKey)}
                                openLabel={t("ui.propertyOpenPhoto")}
                                onOpen={openPhoto}
                              />
                            )}
                          </>
                        )}
                      </section>
                    );
                  })}
                  <AuditNotesList notes={auditNoteList} />
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
                  <PhotoStrip
                    photos={orphanPhotos}
                    label={t("ui.propertyAuditPhotos")}
                    openLabel={t("ui.propertyOpenPhoto")}
                    onOpen={openPhoto}
                  />
                </section>
              )}
              {historyPhotos.length > 0 && (
                <section className="fk-property-section">
                  <details className="fk-property-earlier">
                    <summary className="fk-property-section-title">{t("ui.propertyEarlierPhotos")}</summary>
                    <PhotoStrip
                      photos={historyPhotos.map((p) => ({ url: p.url, caption: p.caption }))}
                      label={t("ui.propertyEarlierPhotos")}
                      openLabel={t("ui.propertyOpenPhoto")}
                      onOpen={openPhoto}
                    />
                  </details>
                </section>
              )}
            </div>
          </div>
        )}
      </main>
      <PhotoLightbox
        photos={galleryPhotos.map((p, i) => ({
          url: p.url,
          caption: p.caption,
          alt: p.caption ?? `${t("ui.propertyOpenPhoto")} ${i + 1}`,
        }))}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
        closeLabel={t("ui.closePhoto")}
        prevLabel={t("ui.photoPrev")}
        nextLabel={t("ui.photoNext")}
      />
    </div>
  );
}
