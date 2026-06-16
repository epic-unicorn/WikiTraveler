"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@wikitraveler/ui";
import { auditHref } from "../lib/auditHref";
import { getAuthHeaders, getStoredNodeUrl } from "../lib/fieldKitApi";
import {
  clearRecentAudits,
  readRecentAudits,
  removeRecentAudit,
  type RecentAuditItem,
} from "../lib/recentAudits";

interface Props {
  homeNodeUrl: string;
}

export function RecentTab({ homeNodeUrl }: Props) {
  const { t, locale } = useLocale();
  const [items, setItems] = useState<RecentAuditItem[]>([]);
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(false);

  const reload = useCallback(() => {
    setItems(readRecentAudits());
  }, []);

  useEffect(() => {
    reload();
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

  if (items.length === 0) {
    return (
      <div className="fk-empty" style={{ paddingTop: 48 }}>
        <span className="fk-empty-icon">📋</span>
        <p className="fk-empty-title">{t("ui.recentEmpty")}</p>
        <p className="fk-empty-body">{t("ui.recentEmptyBody")}</p>
      </div>
    );
  }

  const fallbackNodeUrl = getStoredNodeUrl();
  const staleCount = missingIds.size;

  return (
    <div className="tab-content" style={{ paddingTop: 16 }}>
      <p className="fk-section-header" style={{ paddingTop: 4 }}>
        {t("ui.recentTitle")} — {items.length}{" "}
        {items.length === 1 ? t("ui.searchSingleProperty") : t("ui.searchPropertyCount", { count: items.length })}
        {checking && (
          <span style={{ fontWeight: 400, color: "var(--wt-text-muted)" }}> · {t("ui.checking")}</span>
        )}
      </p>

      {staleCount > 0 && !checking && (
        <p className="status-muted" style={{ fontSize: 13, marginBottom: 12 }}>
          {t("ui.recentStale")}
        </p>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {items.map((p) => {
          const date = new Date(p.auditedAt);
          const label = date.toLocaleDateString(locale, {
            month: "short",
            day: "numeric",
          });
          const propertyNodeUrl = p.nodeUrl ?? fallbackNodeUrl;
          const isMissing = missingIds.has(p.id);

          return (
            <Link
              key={p.id}
              href={auditHref(p.id, propertyNodeUrl, homeNodeUrl)}
              style={{ textDecoration: "none", opacity: isMissing ? 0.75 : 1 }}
            >
              <div className="recent-row">
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: "var(--wt-accent-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  📝
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="recent-name">{p.name}</p>
                  <p className="recent-loc">{p.location}</p>
                  {isMissing && (
                    <p style={{ fontSize: 11, color: "var(--wt-danger)", marginTop: 2 }}>
                      No longer on node
                    </p>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p className="recent-date">{label}</p>
                  {isMissing ? (
                    <button
                      type="button"
                      onClick={(e) => handleRemove(p.id, e)}
                      style={{
                        fontSize: 11,
                        color: "var(--wt-text-muted)",
                        marginTop: 3,
                        fontWeight: 600,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      {t("ui.recentRemove")}
                    </button>
                  ) : (
                    <p style={{ fontSize: 11, color: "var(--wt-primary)", marginTop: 3, fontWeight: 600 }}>
                      {t("ui.recentReaudit")}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleClearAll}
        style={{
          marginTop: 16,
          background: "none",
          border: "none",
          color: "var(--wt-text-muted)",
          fontSize: 13,
          cursor: "pointer",
          padding: 0,
        }}
      >
        {t("ui.recentClear")}
      </button>
    </div>
  );
}
