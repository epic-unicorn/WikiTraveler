"use client";

import { useMemo, useState } from "react";
import {
  formatFieldLabel,
  resolveFactDisplay,
} from "../../lib/factDisplay";

export interface ExistingFact {
  fieldName: string;
  value: string;
  tier: string;
  signatureHash?: string | null;
  timestamp?: string;
}

export interface AuditPhotos {
  submissionId: string;
  capturedAt: string;
  photos: string[];
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

function FactRow({ fact }: { fact: ExistingFact }) {
  const [open, setOpen] = useState(false);
  const { displayValue, confidence, evidence, rawValue } = resolveFactDisplay(fact);
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
        <span className="existing-fact-row-label">{formatFieldLabel(fact.fieldName)}</span>
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
      items.push({ id: "photos", label: "Photos", count: photoCount });
    }
    if (verifiedFacts.length > 0) {
      items.push({ id: "verified", label: "Verified", count: verifiedFacts.length });
    }
    if (aiFacts.length > 0) {
      items.push({ id: "ai", label: "AI", count: aiFacts.length });
    }
    if (officialFacts.length > 0) {
      items.push({ id: "official", label: "Official", count: officialFacts.length });
    }
    return items;
  }, [photoCount, verifiedFacts.length, aiFacts.length, officialFacts.length]);

  const defaultTab = tabs[0]?.id ?? "verified";

  if (facts.length === 0 && photoCount === 0) return null;

  const currentTab = tabs.some((t) => t.id === activeTab) ? activeTab : defaultTab;

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
          <span className="existing-data-title">Current data</span>
          <div className="existing-data-chips">
            {verifiedFacts.length > 0 && (
              <span className="data-chip data-chip--verified">
                {verifiedFacts.length} verified
              </span>
            )}
            {aiFacts.length > 0 && (
              <span className="data-chip data-chip--ai">
                {aiFacts.length} AI
              </span>
            )}
            {photoCount > 0 && (
              <span className="data-chip data-chip--photos">
                {photoCount} photo{photoCount > 1 ? "s" : ""}
              </span>
            )}
            {verifiedFacts.length === 0 && aiFacts.length === 0 && photoCount === 0 && (
              <span className="data-chip">{facts.length} fields</span>
            )}
          </div>
        </div>
        <span className="existing-data-chevron" aria-hidden="true">
          {panelOpen ? "▾" : "▸"}
        </span>
      </button>

      {panelOpen && tabs.length > 0 && (
        <div className="existing-data-body">
          <div className="existing-data-tabs" role="tablist" aria-label="Data sections">
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
                  {hasAiGuess ? "Used for AI analysis" : "Latest audit submission"}
                </p>
                <div className="audit-photos-strip">
                  {auditPhotos.photos.map((src, i) => (
                    <button
                      key={`${auditPhotos.submissionId}-${i}`}
                      type="button"
                      className={`audit-photo-thumb${expandedPhoto === i ? " is-active" : ""}`}
                      onClick={() => setExpandedPhoto(expandedPhoto === i ? null : i)}
                      aria-label={`Audit photo ${i + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Audit photo ${i + 1}`} />
                    </button>
                  ))}
                </div>
                {expandedPhoto !== null && auditPhotos.photos[expandedPhoto] && (
                  <div className="audit-photo-expanded">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={auditPhotos.photos[expandedPhoto]}
                      alt={`Audit photo ${expandedPhoto + 1}`}
                    />
                  </div>
                )}
                <p className="audit-photos-date">
                  {new Date(auditPhotos.capturedAt).toLocaleString()}
                </p>
              </section>
            ) : null}

            {currentTab === "verified" && (
              <div className="existing-fact-rows">
                {verifiedFacts.map((fact) => (
                  <FactRow key={`${fact.fieldName}-${fact.tier}`} fact={fact} />
                ))}
              </div>
            )}

            {currentTab === "ai" && (
              <div className="existing-fact-rows">
                <p className="existing-data-panel-hint">
                  Tap a row to read the full estimate.
                </p>
                {aiFacts.map((fact) => (
                  <FactRow
                    key={`${fact.fieldName}-${fact.tier}`}
                    fact={fact}
                  />
                ))}
              </div>
            )}

            {currentTab === "official" && (
              <div className="existing-fact-rows">
                {officialFacts.map((fact) => (
                  <FactRow key={`${fact.fieldName}-${fact.tier}`} fact={fact} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
