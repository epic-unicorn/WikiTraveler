"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@wikitraveler/ui";
import { propertyOrAuditHref } from "../lib/propertyHref";
import { readAuthToken } from "../lib/authStorage";
import { canContribute, roleFromToken } from "../lib/userRole";
import { getAuthHeaders, getStoredNodeUrl } from "../lib/accessApi";
import {
  RECENT_AUDITS_KEY,
  clearRecentAudits,
  readRecentAudits,
  removeRecentAudit,
  type RecentAuditItem,
} from "../lib/recentAudits";

interface Props {
  homeNodeUrl: string;
  /** Compact layout for embedding on the search tab */
  compact?: boolean;
  maxItems?: number;
  showClear?: boolean;
  onItemsChange?: (count: number) => void;
}

export function RecentPropertiesSection({
  homeNodeUrl,
  compact = false,
  maxItems = 10,
  showClear = true,
  onItemsChange,
}: Props) {
  const { t, locale } = useLocale();
  const [items, setItems] = useState<RecentAuditItem[]>([]);
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(false);
  const [contributor, setContributor] = useState(false);

  useEffect(() => {
    const token = readAuthToken();
    setContributor(canContribute(roleFromToken(token)));
  }, []);

  const reload = useCallback(() => {
    const next = readRecentAudits().slice(0, maxItems);
    setItems(next);
    onItemsChange?.(next.length);
  }, [maxItems, onItemsChange]);

  useEffect(() => {
    reload();
    const onStorage = (e: StorageEvent) => {
      if (e.key === RECENT_AUDITS_KEY) reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [reload]);

  useEffect(() => {
    if (items.length === 0) {
      setMissingIds(new Set());
      return;
    }

    let cancelled = false;
    setChecking(true);

    Promise.all(
      items.map(async (item) => {
        const nodeUrl = item.nodeUrl ?? getStoredNodeUrl();
        try {
          const res = await fetch(
            `${nodeUrl}/api/properties/${encodeURIComponent(item.id)}/accessibility`,
            { headers: getAuthHeaders(), cache: "no-store" }
          );
          return { id: item.id, missing: res.status === 404 };
        } catch {
          return { id: item.id, missing: false };
        }
      })
    )
      .then((results) => {
        if (cancelled) return;
        setMissingIds(new Set(results.filter((r) => r.missing).map((r) => r.id)));
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [items]);

  function handleRemove(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    removeRecentAudit(id);
    reload();
  }

  function handleClearAll() {
    clearRecentAudits();
    reload();
  }

  if (items.length === 0) return null;

  const fallbackNodeUrl = getStoredNodeUrl();
  const staleCount = missingIds.size;

  return (
    <section
      className={compact ? "fk-recent-section fk-recent-section--compact" : "fk-recent-section"}
      aria-labelledby="fk-recent-properties-heading"
    >
      <div className="fk-recent-section-header">
        <h2 id="fk-recent-properties-heading" className="fk-section-header" style={{ paddingTop: compact ? 0 : 4 }}>
          {t("ui.recentTitle")}
          {checking && (
            <span style={{ fontWeight: 400, color: "var(--wt-text-muted)" }}> · {t("ui.checking")}</span>
          )}
        </h2>
      </div>

      {staleCount > 0 && !checking && (
        <p className="status-muted" style={{ fontSize: 13, marginBottom: 12 }}>
          {t("ui.recentStale")}
        </p>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {items.map((p) => {
          const date = new Date(p.auditedAt);
          const label = date.toLocaleDateString(locale, { month: "short", day: "numeric" });
          const propertyNodeUrl = p.nodeUrl ?? fallbackNodeUrl;
          const isMissing = missingIds.has(p.id);

          return (
            <Link
              key={p.id}
              href={propertyOrAuditHref(p.id, propertyNodeUrl, homeNodeUrl, contributor)}
              style={{ textDecoration: "none", opacity: isMissing ? 0.75 : 1 }}
            >
              <div className="recent-row">
                <div className="recent-row-icon" aria-hidden="true">📝</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="recent-name">{p.name}</p>
                  <p className="recent-loc">{p.location}</p>
                  {isMissing && (
                    <p style={{ fontSize: 11, color: "var(--wt-danger)", marginTop: 2 }}>
                      {t("ui.propertyMissingTitle")}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p className="recent-date">{label}</p>
                  {isMissing ? (
                    <button
                      type="button"
                      onClick={(e) => handleRemove(p.id, e)}
                      className="recent-action-btn"
                    >
                      {t("ui.recentRemove")}
                    </button>
                  ) : (
                    <p className="recent-reaudit">{t("ui.recentReaudit")}</p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {showClear && (
        <button type="button" onClick={handleClearAll} className="fk-recent-clear">
          {t("ui.recentClear")}
        </button>
      )}
    </section>
  );
}
