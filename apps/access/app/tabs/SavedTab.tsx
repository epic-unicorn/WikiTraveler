"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "@wikitraveler/ui";
import {
  readSavedPlaces,
  patchSavedPlace,
  removeSavedPlace,
  SAVED_PLACES_EVENT,
  type SavedPlace,
} from "../lib/savedPlaces";
import { propertyHref } from "../lib/propertyHref";
import { fetchPropertyAccessibility } from "../lib/accessApi";
import { saveAccessReturn } from "../lib/navigationReturn";
import { AccessPageHero } from "../components/AccessPageHero";
import { AccessibilityIconRow } from "../components/AccessibilityIconRow";

const PLACEHOLDER_SRC = "/images/property-hero-placeholder.svg";

type SavedSort = "recent" | "nameAsc" | "nameDesc";

interface Props {
  homeNodeUrl: string;
  active?: boolean;
  onAddLocation?: () => void;
}

function thumbSrc(place: SavedPlace): string {
  return place.imageUrl || PLACEHOLDER_SRC;
}

function matchesQuery(place: SavedPlace, q: string): boolean {
  if (!q) return true;
  const hay = `${place.name} ${place.location}`.toLowerCase();
  return hay.includes(q);
}

export function SavedTab({ homeNodeUrl, active = true, onAddLocation }: Props) {
  const { t, locale } = useLocale();
  const [saved, setSaved] = useState<SavedPlace[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SavedSort>("recent");
  const [menuId, setMenuId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      const needsHydrate = readSavedPlaces().filter(
        (p) => p.imageUrl === undefined || p.facts === undefined
      );
      for (const place of needsHydrate) {
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
          const facts = (data.facts ?? []).map((f) => ({
            fieldName: f.fieldName,
            value: f.value,
          }));
          if (!cancelled) {
            patchSavedPlace(place.id, {
              imageUrl: url,
              facts,
            });
            setSaved(readSavedPlaces());
          }
        } catch {
          if (!cancelled && !controller.signal.aborted) {
            patchSavedPlace(place.id, {
              imageUrl: place.imageUrl === undefined ? null : place.imageUrl,
              facts: place.facts ?? [],
            });
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = saved.filter((p) => matchesQuery(p, q));
    const sorted = [...filtered];
    if (sort === "nameAsc") sorted.sort((a, b) => a.name.localeCompare(b.name, locale));
    else if (sort === "nameDesc") sorted.sort((a, b) => b.name.localeCompare(a.name, locale));
    else sorted.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    return sorted;
  }, [saved, query, sort, locale]);

  return (
    <div className="tab-content fk-saved-tab">
      <AccessPageHero
        notifyNodeUrl={homeNodeUrl}
        sectionTitle={t("ui.savedTitle")}
        sectionSubtitle={t("ui.savedSubtitle")}
      >
        {saved.length > 0 && (
          <div className="fk-saved-toolbar">
            <label className="fk-saved-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("ui.savedSearchPlaceholder")}
                aria-label={t("ui.savedSearchPlaceholder")}
              />
            </label>
            <label className="fk-saved-sort">
              <span className="wt-sr-only">{t("ui.savedSort")}</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SavedSort)}
                aria-label={t("ui.savedSort")}
              >
                <option value="recent">{t("ui.savedSortRecent")}</option>
                <option value="nameAsc">{t("ui.savedSortNameAsc")}</option>
                <option value="nameDesc">{t("ui.savedSortNameDesc")}</option>
              </select>
            </label>
          </div>
        )}
      </AccessPageHero>

      <div className="fk-page-body">
        {saved.length === 0 ? (
          <p className="fk-saved-empty">{t("ui.savedEmpty")}</p>
        ) : visible.length === 0 ? (
          <p className="fk-saved-empty">{t("ui.searchNoResults")}</p>
        ) : (
          <ul className="fk-saved-list">
            {visible.map((p) => (
              <li key={p.id} className="fk-saved-card fk-saved-card--rich">
                <div className="fk-saved-card__top">
                  <span className="fk-saved-card__thumb" aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="fk-saved-card__thumb-img"
                      src={thumbSrc(p)}
                      alt=""
                      loading="lazy"
                    />
                  </span>
                  <div className="fk-saved-card__main">
                    <div className="fk-saved-card__actions">
                      <button
                        type="button"
                        className="fk-saved-heart"
                        aria-label={t("ui.savedRemove")}
                        title={t("ui.savedRemove")}
                        onClick={() => removeSavedPlace(p.id)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="currentColor"
                            d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                          />
                        </svg>
                      </button>
                      <div className="fk-saved-more">
                        <button
                          type="button"
                          className="fk-saved-more__btn"
                          aria-label={t("ui.savedMoreActions")}
                          aria-expanded={menuId === p.id}
                          onClick={() => setMenuId((id) => (id === p.id ? null : p.id))}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <circle cx="12" cy="5" r="1.6" />
                            <circle cx="12" cy="12" r="1.6" />
                            <circle cx="12" cy="19" r="1.6" />
                          </svg>
                        </button>
                        {menuId === p.id && (
                          <div className="fk-saved-more__menu" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                removeSavedPlace(p.id);
                                setMenuId(null);
                              }}
                            >
                              {t("ui.savedRemove")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <strong className="fk-saved-card__name">{p.name}</strong>
                    <span className="fk-saved-card__loc">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {p.location}
                    </span>
                    {p.facts && p.facts.length > 0 && (
                      <AccessibilityIconRow facts={p.facts} max={4} />
                    )}
                  </div>
                </div>
                <Link
                  href={propertyHref(p.id, p.nodeUrl, homeNodeUrl)}
                  className="fk-saved-card__cta-btn"
                  onClick={() => saveAccessReturn({ tab: "saved" })}
                >
                  {t("ui.mapViewProperty")}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className="fk-saved-add"
          onClick={() => onAddLocation?.()}
        >
          <span aria-hidden="true">+</span>
          {t("ui.savedAddLocation")}
        </button>
      </div>
    </div>
  );
}
