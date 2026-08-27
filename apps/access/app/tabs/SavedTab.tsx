"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@wikitraveler/ui";
import {
  readSavedPlaces,
  patchSavedPlace,
  SAVED_PLACES_EVENT,
  type SavedPlace,
} from "../lib/savedPlaces";
import { propertyHref } from "../lib/propertyHref";
import { fetchPropertyAccessibility } from "../lib/accessApi";
import { saveAccessReturn } from "../lib/navigationReturn";
import { AccessPageHero } from "../components/AccessPageHero";

const PLACEHOLDER_SRC = "/images/property-hero-placeholder.png";

interface Props {
  homeNodeUrl: string;
  active?: boolean;
}

function thumbSrc(place: SavedPlace): string {
  return place.imageUrl || PLACEHOLDER_SRC;
}

export function SavedTab({ homeNodeUrl, active = true }: Props) {
  const { t, locale } = useLocale();
  const [saved, setSaved] = useState<SavedPlace[]>([]);

  useEffect(() => {
    const sync = () => setSaved(readSavedPlaces());
    sync();
    window.addEventListener(SAVED_PLACES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SAVED_PLACES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (active) setSaved(readSavedPlaces());
  }, [active]);

  // Hydrate thumbnails for favorites saved before imageUrl existed.
  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      const needsImage = readSavedPlaces().filter((p) => p.imageUrl === undefined);
      for (const place of needsImage) {
        if (cancelled) break;
        try {
          const data = await fetchPropertyAccessibility(
            place.nodeUrl || homeNodeUrl,
            place.id,
            locale,
            controller.signal
          );
          const url =
            data.property.photos?.[0]?.url ??
            data.auditPhotos?.photos?.[0]?.url ??
            null;
          if (!cancelled) {
            patchSavedPlace(place.id, { imageUrl: url });
            setSaved(readSavedPlaces());
          }
        } catch {
          if (!cancelled && !controller.signal.aborted) {
            patchSavedPlace(place.id, { imageUrl: null });
            setSaved(readSavedPlaces());
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, homeNodeUrl, locale]);

  return (
    <div className="tab-content fk-saved-tab">
      <AccessPageHero
        sectionTitle={t("ui.savedTitle")}
        sectionSubtitle={t("ui.savedSubtitle")}
      />

      <div className="fk-page-body">
        {saved.length === 0 ? (
          <p className="fk-saved-empty">{t("ui.savedEmpty")}</p>
        ) : (
          <ul className="fk-saved-list">
            {saved.map((p) => (
              <li key={p.id} className="fk-saved-card">
                <Link
                  href={propertyHref(p.id, p.nodeUrl, homeNodeUrl)}
                  className="fk-saved-card__link"
                  onClick={() => saveAccessReturn({ tab: "saved" })}
                >
                  <span className="fk-saved-card__thumb" aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="fk-saved-card__thumb-img"
                      src={thumbSrc(p)}
                      alt=""
                      loading="lazy"
                    />
                  </span>
                  <span className="fk-saved-card__body">
                    <strong className="fk-saved-card__name">{p.name}</strong>
                    <span className="fk-saved-card__loc">{p.location}</span>
                    <span className="fk-saved-card__cta">{t("ui.mapViewProperty")}</span>
                  </span>
                  <svg
                    className="fk-saved-card__chevron"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                  >
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
