"use client";

import { useCallback, useEffect, useState } from "react";
import { getSourceLabel } from "@wikitraveler/i18n";
import { useLocale } from "@wikitraveler/ui";
import type { StatsPageData } from "@/lib/statsData";

const TIER_COLOR: Record<string, string> = {
  OFFICIAL: "var(--wt-tier-official-text)",
  AI_GUESS: "var(--wt-warning)",
  VERIFIED: "var(--wt-success)",
  CONFIRMED: "var(--wt-primary)",
};

const SOURCE_COLOR: Record<string, string> = {
  WIKIDATA: "#8b5cf6",
  WHEELMAP: "#0ea5e9",
  OSM: "#10b981",
  WHEEL_THE_WORLD: "#f97316",
  AUDITOR: "#ec4899",
};

const TIERS = ["CONFIRMED", "VERIFIED", "AI_GUESS", "OFFICIAL"] as const;

export function StatsPanel({ token }: { token: string }) {
  const { t, locale, getTierLabel, getFieldLabel } = useLocale();
  const [data, setData] = useState<StatsPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(t("ui.adminCouldNotReachServer"));
        return;
      }
      setData((await res.json()) as StatsPageData);
    } catch {
      setError(t("ui.adminCouldNotReachServer"));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="wt-admin-panel">
        <p className="wt-admin-muted">{t("ui.adminLoadingProperties")}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="wt-admin-panel">
        <p className="wt-admin-error">{error || t("ui.adminCouldNotReachServer")}</p>
        <button type="button" onClick={() => void load()} className="wt-admin-btn">
          {t("ui.adminRefresh")}
        </button>
      </div>
    );
  }

  const {
    propertyCount,
    factCount,
    auditCount,
    peerCount,
    tierCounts,
    sourceCounts,
    fieldCounts,
    propertiesWithFacts,
    recentAudits30d,
    recentUpdates7d,
    recentUpdates30d,
    oldestPropertyUpdatedAt,
    osmLastSync,
    osmItemCount,
    topAuditedWithNames,
    gossipHistory,
    coveragePct,
  } = data;

  return (
    <div className="wt-admin-panel wt-stats-panel">
      <h3 className="wt-admin-panel__title">{t("ui.adminTabStats")}</h3>

      <div className="wt-dashboard-stats">
        <Section title={t("ui.statsOverview")}>
          <div className="wt-stats-grid">
            <BigStat label={t("ui.statsProperties")} value={propertyCount} />
            <BigStat label={t("ui.mapFacts")} value={factCount} />
            <BigStat label={t("ui.statsAudits")} value={auditCount} />
            <BigStat label={t("ui.statsActivePeers")} value={peerCount} />
            <BigStat
              label={t("ui.statsCoverage")}
              value={`${coveragePct}%`}
              sub={t("ui.statsCoverageSub", {
                with: String(propertiesWithFacts),
                total: String(propertyCount),
              })}
            />
          </div>
        </Section>

        <Section title={t("ui.statsFreshness")}>
          <div className="wt-stats-grid">
            <BigStat label={t("ui.statsUpdated7d")} value={recentUpdates7d} />
            <BigStat label={t("ui.statsUpdated30d")} value={recentUpdates30d} />
            <BigStat label={t("ui.statsAudits30d")} value={recentAudits30d} />
            {oldestPropertyUpdatedAt && (
              <BigStat
                label={t("ui.statsOldestRecord")}
                value={new Date(oldestPropertyUpdatedAt).toLocaleDateString(locale)}
                sub={t("ui.statsLastUpdated")}
              />
            )}
            {osmLastSync && (
              <BigStat
                label={t("ui.statsLastOsmIngest")}
                value={new Date(osmLastSync).toLocaleDateString(locale)}
                sub={t("ui.statsItems", { count: osmItemCount ?? "?" })}
              />
            )}
          </div>
        </Section>

        <Section title={t("ui.statsFactsByTier")}>
          <div className="wt-stats-bars">
            {TIERS.map((tier) => {
              const count = tierCounts.find((row) => row.tier === tier)?.count ?? 0;
              const pct = factCount > 0 ? Math.round((count / factCount) * 100) : 0;
              return (
                <div key={tier}>
                  <div className="wt-stats-bar-label">
                    <span>{getTierLabel(tier)}</span>
                    <span>
                      {count.toLocaleString(locale)} ({pct}%)
                    </span>
                  </div>
                  <div className="wt-stats-bar-track">
                    <div className="wt-stats-bar-fill" style={{ width: `${pct}%`, background: TIER_COLOR[tier] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title={t("ui.statsFactsBySource")}>
          <div className="wt-stats-bars">
            {[...sourceCounts]
              .sort((a, b) => b.count - a.count)
              .map(({ sourceType, count }) => {
                const pct = factCount > 0 ? Math.round((count / factCount) * 100) : 0;
                return (
                  <div key={sourceType}>
                    <div className="wt-stats-bar-label">
                      <span>{getSourceLabel(sourceType, locale)}</span>
                      <span>
                        {count.toLocaleString(locale)} ({pct}%)
                      </span>
                    </div>
                    <div className="wt-stats-bar-track">
                      <div
                        className="wt-stats-bar-fill"
                        style={{ width: `${pct}%`, background: SOURCE_COLOR[sourceType] ?? "var(--wt-text-muted)" }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </Section>

        <Section title={t("ui.statsMostAuditedFields")}>
          <table className="wt-admin-table">
            <thead>
              <tr>
                <th>{t("ui.lensFactFeature")}</th>
                <th className="wt-admin-table__num">{t("ui.mapFacts")}</th>
              </tr>
            </thead>
            <tbody>
              {fieldCounts.map(({ fieldName, count }) => (
                <tr key={fieldName}>
                  <td>{getFieldLabel(fieldName)}</td>
                  <td className="wt-admin-table__num">{count.toLocaleString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title={t("ui.statsMostAuditedProperties")}>
          <table className="wt-admin-table">
            <thead>
              <tr>
                <th>{t("ui.statsProperties")}</th>
                <th className="wt-admin-table__num">{t("ui.statsAuditSubmissions")}</th>
              </tr>
            </thead>
            <tbody>
              {topAuditedWithNames.map(({ name, count }) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td className="wt-admin-table__num">{count}</td>
                </tr>
              ))}
              {topAuditedWithNames.length === 0 && (
                <tr>
                  <td colSpan={2} className="wt-admin-muted wt-admin-table__empty">
                    {t("ui.statsNoAuditsYet")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>

        {gossipHistory.length > 0 && (
          <Section title={t("ui.statsRecentGossip")} className="wt-dashboard-stats__full">
            <table className="wt-admin-table">
              <thead>
                <tr>
                  <th>{t("ui.statsFromNode")}</th>
                  <th className="wt-admin-table__num">{t("ui.statsFactsIngested")}</th>
                  <th className="wt-admin-table__num">{t("ui.statsWhen")}</th>
                </tr>
              </thead>
              <tbody>
                {gossipHistory.map((g, i) => (
                  <tr key={i}>
                    <td className="wt-admin-mono">{g.fromNodeId}</td>
                    <td className="wt-admin-table__num">{g.factCount}</td>
                    <td className="wt-admin-table__num">{new Date(g.appliedAt).toLocaleString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`wt-stats-section${className ? ` ${className}` : ""}`}>
      <h4 className="wt-stats-section__title">{title}</h4>
      {children}
    </section>
  );
}

function BigStat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="wt-stats-big">
      <div className="wt-stats-big__value">{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className="wt-stats-big__label">{label}</div>
      {sub && <div className="wt-stats-big__sub">{sub}</div>}
    </div>
  );
}
