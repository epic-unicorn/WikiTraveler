"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  PropertySearchBar,
  PropertyCard,
  EMPTY_FILTERS,
  useLocale,
  type SearchFilters,
  type PropertySummary,
  type SearchFeature,
} from "@wikitraveler/ui";
import { searchProperties } from "../lib/fieldKitApi";
import { auditHref } from "../lib/auditHref";

interface Props {
  searchNodeUrl: string;
  homeNodeUrl: string;
  gpsResolved: { region: string | null } | null;
}

export function SearchTab({ searchNodeUrl, homeNodeUrl, gpsResolved }: Props) {
  const { locale, t } = useLocale();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [searchFeatures, setSearchFeatures] = useState<SearchFeature[]>([]);
  const [results, setResults] = useState<PropertySummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch(`${searchNodeUrl}/api/fields?locale=${locale}`)
      .then((r) => r.json())
      .then((data: { fields?: Array<{ fieldName: string; label: string; searchFilter: boolean; valueType: string }> }) => {
        setSearchFeatures(
          (data.fields ?? [])
            .filter((f) => f.searchFilter && f.valueType === "BOOLEAN")
            .map((f) => ({ key: f.fieldName, label: f.label }))
        );
      })
      .catch(() => {});
  }, [locale, searchNodeUrl]);

  const hasActiveSearch =
    query.trim().length > 0 ||
    filters.features.length > 0 ||
    filters.audited !== null ||
    filters.hasAccessibleRoom ||
    filters.location.trim().length > 0;

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    if (!hasActiveSearch) {
      setResults(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const properties = await searchProperties(
          searchNodeUrl,
          query,
          filters,
          controller.signal
        );
        setResults(properties);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setSearchError(t("ui.searchNodeUnreachable"));
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, filters, searchNodeUrl, hasActiveSearch, t]);

  return (
    <div className="tab-content">
      <div style={{ paddingTop: 16, marginBottom: 4 }}>
        <PropertySearchBar
          query={query}
          onQueryChange={setQuery}
          filters={filters}
          onFiltersChange={setFilters}
          searchFeatures={searchFeatures}
        />
      </div>

      {gpsResolved && (
        <div style={{ marginBottom: 12 }}>
          <span className="fk-chip fk-chip--info">
            📍 {gpsResolved.region ?? searchNodeUrl}
          </span>
        </div>
      )}

      {loading && (
        <p className="status-muted" style={{ textAlign: "center", padding: "20px 0" }}>
          {t("ui.searching")}
        </p>
      )}

      {searchError && <p className="status-err">{searchError}</p>}

      {results !== null && results.length === 0 && !loading && (
        <div className="fk-empty">
          <span className="fk-empty-icon">🔍</span>
          <p className="fk-empty-title">{t("ui.searchNoResults")}</p>
          <p className="fk-empty-body">
            {query.trim()
              ? t("ui.searchNoMatch", { query: query.trim() })
              : t("ui.searchTryDifferent")}{" "}
            {t("ui.searchTapPlus")}
          </p>
        </div>
      )}

      {results !== null && results.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {results.map((p) => (
            <Link key={p.id} href={auditHref(p.id, searchNodeUrl, homeNodeUrl)}>
              <PropertyCard property={p} expandable={false} />
            </Link>
          ))}
        </div>
      )}

      {results === null && !hasActiveSearch && !loading && (
        <div className="fk-empty">
          <span className="fk-empty-icon">🏨</span>
          <p className="fk-empty-title">{t("ui.searchFindTitle")}</p>
          <p className="fk-empty-body">{t("ui.searchFindBody")}</p>
        </div>
      )}
    </div>
  );
}
