"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@wikitraveler/ui";
import { resolveFactDisplay } from "../../lib/factDisplay";

export interface ExistingFact {
  fieldName: string;
  value: string;
  tier: string;
  signatureHash?: string | null;
  timestamp?: string;
}

export interface AuditPhotoItem {
  id?: string;
  url: string;
  caption?: string | null;
}

export interface AuditPhotos {
  submissionId: string;
  capturedAt: string;
  photos: Array<string | AuditPhotoItem>;
}

function photoUrl(photo: string | AuditPhotoItem): string {
  return typeof photo === "string" ? photo : photo.url;
}

interface Props {
  facts: ExistingFact[];
  auditPhotos: AuditPhotos | null;
  hasAiGuess: boolean;
}

type TabId = "photos" | "verified" | "ai" | "official";

const VERIFIED_TIERS = new Set(["VERIFIED", "CONFIRMED"]);

function truncate(text: string, max = 72): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function FactRow({ fact, locale }: { fact: ExistingFact; locale: string }) {
  const [open, setOpen] = useState(false);
  const { label, displayValue, confidence, evidence, rawValue } = resolveFactDisplay(fact, locale);
  const showEvidence =
    fact.tier === "AI_GUESS" &&
    evidence &&
    evidence !== displayValue &&
    !["high", "medium", "low"].includes(rawValue.toLowerCase());
  const longValue = displayValue.length > 48 || showEvidence;

  return (
    <div className={`existing-fact-row${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="existing-fact-row-main"
        onClick={() => {
          if (longValue) setOpen((v) => !v);
        }}
        disabled={!longValue}
        aria-expanded={longValue ? open : undefined}
      >
        <span className="existing-fact-row-label">{label}</span>
        <span className="existing-fact-row-value">
          {open || !longValue ? displayValue : truncate(displayValue)}
        </span>
        {fact.tier === "AI_GUESS" && confidence ? (
          <span className="confidence-chip">{confidence}</span>
        ) : null}
        {longValue ? (
          <span className="existing-fact-row-chevron" aria-hidden="true">
            {open ? "▾" : "▸"}
          </span>
        ) : null}
      </button>
      {open && showEvidence ? (
        <p className="existing-fact-evidence">{evidence}</p>
      ) : null}
    </div>
  );
}

export default function ExistingDataPanel({ facts, auditPhotos, hasAiGuess }: Props) {
  const { locale, t } = useLocale();
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("verified");
  const [expandedPhoto, setExpandedPhoto] = useState<number | null>(null);

  const verifiedFacts = facts.filter((f) => VERIFIED_TIERS.has(f.tier));
  const aiFacts = facts.filter((f) => f.tier === "AI_GUESS");
  const officialFacts = facts.filter((f) => f.tier === "OFFICIAL");
  const photoCount = auditPhotos?.photos.length ?? 0;

  const tabs = useMemo(() => {
    const items: Array<{ id: TabId; label: string; count: number }> = [];
    if (photoCount > 0) {
      items.push({ id: "photos", label: t("ui.existingDataPhotos"), count: photoCount });
    }
    if (verifiedFacts.length > 0) {
      items.push({ id: "verified", label: t("ui.existingDataVerified"), count: verifiedFacts.length });
    }
    if (aiFacts.length > 0) {
      items.push({ id: "ai", label: t("ui.existingDataAi"), count: aiFacts.length });
    }
    if (officialFacts.length > 0) {
      items.push({ id: "official", label: t("ui.existingDataOfficial"), count: officialFacts.length });
    }
    return items;
  }, [photoCount, verifiedFacts.length, aiFacts.length, officialFacts.length, t]);

  const defaultTab = tabs[0]?.id ?? "verified";

  if (facts.length === 0 && photoCount === 0) return null;

  const currentTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : defaultTab;

  return (
    <div className={`card existing-data-panel${panelOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="existing-data-toggle"
        onClick={() => {
          if (!panelOpen) setActiveTab(tabs[0]?.id ?? "verified");
          setPanelOpen((v) => !v);
        }}
        aria-expanded={panelOpen}
      >
        <div className="existing-data-toggle-text">
          <span className="existing-data-title">{t("ui.existingDataTitle")}</span>
          <div className="existing-data-chips">
            {verifiedFacts.length > 0 && (
              <span className="data-chip data-chip--verified">
                {t("ui.existingDataVerifiedChip", { count: verifiedFacts.length })}
              </span>
            )}
            {aiFacts.length > 0 && (
              <span className="data-chip data-chip--ai">
                {t("ui.existingDataAiChip", { count: aiFacts.length })}
              </span>
            )}
            {photoCount > 0 && (
              <span className="data-chip data-chip--photos">
                {t("ui.existingDataPhotosChip", { count: photoCount })}
              </span>
            )}
            {verifiedFacts.length === 0 && aiFacts.length === 0 && photoCount === 0 && (
              <span className="data-chip">{t("ui.existingDataFieldsChip", { count: facts.length })}</span>
            )}
          </div>
        </div>
        <span className="existing-data-chevron" aria-hidden="true">
          {panelOpen ? "▾" : "▸"}
        </span>
      </button>

      {panelOpen && tabs.length > 0 && (
        <div className="existing-data-body">
          <div className="existing-data-tabs" role="tablist" aria-label={t("ui.existingDataSections")}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={currentTab === tab.id}
                className={`existing-data-tab${currentTab === tab.id ? " is-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                <span className="existing-data-tab-count">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="existing-data-tab-panel">
            {currentTab === "photos" && auditPhotos?.photos.length ? (
              <section className="audit-photos-block">
                <p className="existing-data-panel-hint">
                  {hasAiGuess ? t("ui.existingDataUsedForAi") : t("ui.existingDataLatest")}
                </p>
                <div className="audit-photos-strip">
                  {auditPhotos.photos.map((photo, i) => (
                    <button
                      key={`${auditPhotos.submissionId}-${i}`}
                      type="button"
                      className={`audit-photo-thumb${expandedPhoto === i ? " is-active" : ""}`}
                      onClick={() => setExpandedPhoto(expandedPhoto === i ? null : i)}
                      aria-label={`${t("ui.existingDataPhotos")} ${i + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl(photo)} alt={`${t("ui.existingDataPhotos")} ${i + 1}`} />
                    </button>
                  ))}
                </div>
                {expandedPhoto !== null && auditPhotos.photos[expandedPhoto] && (
                  <div className="audit-photo-expanded">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl(auditPhotos.photos[expandedPhoto])}
                      alt={`${t("ui.existingDataPhotos")} ${expandedPhoto + 1}`}
                    />
                  </div>
                )}
                <p className="audit-photos-date">
                  {new Date(auditPhotos.capturedAt).toLocaleString(locale)}
                </p>
              </section>
            ) : null}

            {currentTab === "verified" && (
              <div className="existing-fact-rows">
                {verifiedFacts.map((fact) => (
                  <FactRow key={`${fact.fieldName}-${fact.tier}`} fact={fact} locale={locale} />
                ))}
              </div>
            )}

            {currentTab === "ai" && (
              <div className="existing-fact-rows">
                <p className="existing-data-panel-hint">{t("ui.existingDataTapRow")}</p>
                {aiFacts.map((fact) => (
                  <FactRow key={`${fact.fieldName}-${fact.tier}`} fact={fact} locale={locale} />
                ))}
              </div>
            )}

            {currentTab === "official" && (
              <div className="existing-fact-rows">
                {officialFacts.map((fact) => (
                  <FactRow key={`${fact.fieldName}-${fact.tier}`} fact={fact} locale={locale} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
