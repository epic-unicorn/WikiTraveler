"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@wikitraveler/ui";
import type { MapPin } from "../lib/accessApi";
import { fetchPropertyAccessibility } from "../lib/accessApi";
import { propertyHref } from "../lib/propertyHref";
import { auditHref } from "../lib/auditHref";
import { saveAccessReturn, type AccessReturnState } from "../lib/navigationReturn";
import { readAuthToken } from "../lib/authStorage";
import { canContribute, roleFromToken } from "../lib/userRole";
import { readSavedPlaces } from "../lib/savedPlaces";
import { AccessibilityIconRow } from "./AccessibilityIconRow";

const PLACEHOLDER_SRC = "/images/property-hero-placeholder.svg";

const TIER_RANK: Record<string, number> = {
  OFFICIAL: 0,
  AI_GUESS: 1,
  VERIFIED: 2,
  CONFIRMED: 3,
};

const FACT_LABEL_KEYS: Record<string, string> = {
  step_free_entrance: "a11yPref_step_free_entrance",
  accessible_bathroom: "a11yPref_accessible_bathroom",
  elevator_present: "a11yPref_elevator_present",
  ramp_present: "a11yPref_ramp_present",
  parking_accessible: "a11yPref_parking_accessible",
  hearing_loop: "a11yPref_hearing_loop",
  braille_signage: "a11yPref_braille_signage",
  visual_alarms: "a11yPref_visual_alarms",
};

function truthy(value: string): boolean {
  const v = value.toLowerCase();
  return v === "yes" || v === "true" || v === "partial";
}

function topHighlights(pin: MapPin, max = 3): Array<{ field: string; value: string; tier: string }> {
  const facts = pin.facts ?? {};
  return Object.entries(facts)
    .filter(([, f]) => truthy(f.value))
    .sort(([, a], [, b]) => (TIER_RANK[b.tier] ?? 0) - (TIER_RANK[a.tier] ?? 0))
    .slice(0, max)
    .map(([field, f]) => ({ field, value: f.value, tier: f.tier }));
}

function savedImageFor(id: string): string | null {
  const place = readSavedPlaces().find((p) => p.id === id);
  return place?.imageUrl || null;
}

interface Props {
  pin: MapPin;
  homeNodeUrl: string;
  propertyNodeUrl: string;
  saved?: boolean;
  returnState?: AccessReturnState;
  onClose: () => void;
}

export function PropertyMapPreview({
  pin,
  homeNodeUrl,
  propertyNodeUrl,
  saved = false,
  returnState,
  onClose,
}: Props) {
  const { t, getTierLabel, locale } = useLocale();
  const contributor = canContribute(roleFromToken(readAuthToken()));
  const highlights = topHighlights(pin);
  const viewUrl = propertyHref(pin.id, propertyNodeUrl, homeNodeUrl);
  const auditUrl = auditHref(pin.id, propertyNodeUrl, homeNodeUrl);
  const [imageUrl, setImageUrl] = useState(PLACEHOLDER_SRC);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const cached = savedImageFor(pin.id);
    if (cached) {
      setImageUrl(cached);
      return;
    }

    setImageUrl(PLACEHOLDER_SRC);
    let cancelled = false;
    const controller = new AbortController();

    void fetchPropertyAccessibility(propertyNodeUrl, pin.id, locale, controller.signal)
      .then((data) => {
        const url =
          data.property.photos?.[0]?.url ?? data.auditPhotos?.photos?.[0]?.url ?? null;
        if (!cancelled) setImageUrl(url || PLACEHOLDER_SRC);
      })
      .catch(() => {
        if (!cancelled && !controller.signal.aborted) setImageUrl(PLACEHOLDER_SRC);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [pin.id, propertyNodeUrl, locale]);

  function rememberReturn() {
    if (returnState) saveAccessReturn(returnState);
    onClose();
  }

  return (
    <div
      className="fk-map-preview"
      role="dialog"
      aria-modal="false"
      aria-labelledby={`map-preview-title-${pin.id}`}
    >
      <div className="fk-map-preview__chrome">
        <div className="fk-map-preview__handle" aria-hidden="true" />
        <button
          type="button"
          className="fk-map-preview__close"
          onClick={onClose}
          aria-label={t("ui.close")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="fk-map-preview__body">
        <div className="fk-map-preview__summary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="fk-map-preview__photo"
            src={imageUrl}
            alt=""
            loading="lazy"
          />
          <div className="fk-map-preview__intro">
            <div className="fk-map-preview__head">
              <h2
                id={`map-preview-title-${pin.id}`}
                className="fk-property-title fk-property-title--section fk-map-preview__title"
              >
                <span className="fk-map-preview__title-text">{pin.name}</span>
                {saved && (
                  <span className="fk-map-preview__saved" title={t("ui.discoverySaved")}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </span>
                )}
              </h2>
              <span className={`fk-map-preview__audit-badge${pin.audited ? " fk-map-preview__audit-badge--yes" : ""}`}>
                {pin.audited ? t("ui.mapAudited") : t("ui.mapNotAudited")}
              </span>
            </div>
            <p className="fk-map-preview__loc">{pin.location}</p>
          </div>
        </div>

        <AccessibilityIconRow facts={pin.facts} max={5} />

        {pin.audited && (
          <p className="fk-map-preview__audit-summary">
            {highlights.length > 0
              ? t("ui.mapAuditSummary", { count: Object.keys(pin.facts ?? {}).length })
              : t("ui.mapAuditedOpen")}
          </p>
        )}

        {highlights.length > 0 ? (
          <ul className="fk-map-preview__facts">
            {highlights.map((h) => {
              const labelKey = FACT_LABEL_KEYS[h.field];
              const label = labelKey
                ? t(`ui.${labelKey}`)
                : h.field.replace(/_/g, " ");
              const value =
                h.value === "partial" ? t("ui.partial") : h.value === "yes" || h.value === "true" ? t("ui.yes") : h.value;
              return (
                <li key={h.field} className="fk-map-preview__fact">
                  <span className="fk-map-preview__fact-label">{label}</span>
                  <span className="fk-map-preview__fact-value">
                    {h.tier !== "OFFICIAL" && (
                      <span className="fk-map-preview__fact-tier">{getTierLabel(h.tier)}</span>
                    )}
                    <span className="fk-map-preview__fact-answer">{value}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          !pin.audited && <p className="fk-map-preview__empty">{t("ui.discoveryA11yNone")}</p>
        )}

        <div className="fk-map-preview__actions">
          <Link href={viewUrl} className="btn-primary fk-map-preview__cta" onClick={rememberReturn}>
            {t("ui.mapViewProperty")}
          </Link>
          {contributor && (
            <Link href={auditUrl} className="btn-secondary fk-map-preview__cta-secondary" onClick={rememberReturn}>
              {t("ui.mapViewAudit")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
