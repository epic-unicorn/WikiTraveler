"use client";

import { getSourceLabel } from "@wikitraveler/i18n";
import { useLocale } from "@wikitraveler/ui";
import { AdminSection } from "../AdminSection";

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

export interface StatsPageData {
  propertyCount: number;
  factCount: number;
  auditCount: number;
  peerCount: number;
  tierCounts: { tier: string; count: number }[];
  sourceCounts: { sourceType: string; count: number }[];
  fieldCounts: { fieldName: string; count: number }[];
  propertiesWithFacts: number;
  recentAudits30d: number;
  recentUpdates7d: number;
  recentUpdates30d: number;
  oldestPropertyUpdatedAt: string | null;
  osmLastSync: string | null;
  osmItemCount: number | null;
  topAuditedWithNames: { name: string; count: number }[];
  gossipHistory: { fromNodeId: string; factCount: number; appliedAt: string }[];
  coveragePct: number;
}

export function StatsPageContent({ data }: { data: StatsPageData }) {
  const { t, locale, getTierLabel, getFieldLabel } = useLocale();
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
    <div className="wt-dashboard-page">
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--wt-text)" }}>
        {t("ui.adminPageTitle")}
      </h2>

      <AdminSection />

      <div className="wt-dashboard-stats">
      <Section title={t("ui.statsOverview")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16 }}>
          <BigStat label={t("ui.statsUpdated7d")} value={recentUpdates7d} />
          <BigStat label={t("ui.statsUpdated30d")} value={recentUpdates30d} />
          <BigStat label={t("ui.statsAudits30d")} value={recentAudits30d} />
          {oldestPropertyUpdatedAt && (
            <BigStat
              label={t("ui.statsOldestRecord")}
              value={new Date(oldestPropertyUpdatedAt).toLocaleDateString()}
              sub={t("ui.statsLastUpdated")}
            />
          )}
          {osmLastSync && (
            <BigStat
              label={t("ui.statsLastOsmIngest")}
              value={new Date(osmLastSync).toLocaleDateString()}
              sub={t("ui.statsItems", { count: osmItemCount ?? "?" })}
            />
          )}
        </div>
      </Section>

      <Section title={t("ui.statsFactsByTier")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {TIERS.map((tier) => {
            const count = tierCounts.find((row) => row.tier === tier)?.count ?? 0;
            const pct = factCount > 0 ? Math.round((count / factCount) * 100) : 0;
            return (
              <div key={tier}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{getTierLabel(tier)}</span>
                  <span style={{ color: "var(--wt-text-muted)" }}>
                    {count.toLocaleString()} ({pct}%)
                  </span>
                </div>
                <div style={{ background: "var(--wt-border)", borderRadius: 4, height: 8 }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      background: TIER_COLOR[tier],
                      height: 8,
                      borderRadius: 4,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title={t("ui.statsFactsBySource")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...sourceCounts]
            .sort((a, b) => b.count - a.count)
            .map(({ sourceType, count }) => {
              const pct = factCount > 0 ? Math.round((count / factCount) * 100) : 0;
              return (
                <div key={sourceType}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{getSourceLabel(sourceType, locale)}</span>
                    <span style={{ color: "var(--wt-text-muted)" }}>
                      {count.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div style={{ background: "var(--wt-border)", borderRadius: 4, height: 8 }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        background: SOURCE_COLOR[sourceType] ?? "var(--wt-text-muted)",
                        height: 8,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </Section>

      <Section title={t("ui.statsMostAuditedFields")}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--wt-bg-secondary)" }}>
              <Th>{t("ui.lensFactFeature")}</Th>
              <Th align="right">{t("ui.mapFacts")}</Th>
            </tr>
          </thead>
          <tbody>
            {fieldCounts.map(({ fieldName, count }) => (
              <tr key={fieldName} style={{ borderBottom: "1px solid var(--wt-border)" }}>
                <Td>{getFieldLabel(fieldName)}</Td>
                <Td align="right">{count.toLocaleString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={t("ui.statsMostAuditedProperties")}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--wt-bg-secondary)" }}>
              <Th>{t("ui.statsProperties")}</Th>
              <Th align="right">{t("ui.statsAuditSubmissions")}</Th>
            </tr>
          </thead>
          <tbody>
            {topAuditedWithNames.map(({ name, count }) => (
              <tr key={name} style={{ borderBottom: "1px solid var(--wt-border)" }}>
                <Td>{name}</Td>
                <Td align="right">{count}</Td>
              </tr>
            ))}
            {topAuditedWithNames.length === 0 && (
              <tr>
                <td
                  colSpan={2}
                  style={{ padding: "12px 8px", color: "var(--wt-text-muted)", textAlign: "center" }}
                >
                  {t("ui.statsNoAuditsYet")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      {gossipHistory.length > 0 && (
        <Section title={t("ui.statsRecentGossip")} className="wt-dashboard-stats__full">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--wt-bg-secondary)" }}>
                <Th>{t("ui.statsFromNode")}</Th>
                <Th align="right">{t("ui.statsFactsIngested")}</Th>
                <Th align="right">{t("ui.statsWhen")}</Th>
              </tr>
            </thead>
            <tbody>
              {gossipHistory.map((g, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--wt-border)" }}>
                  <Td style={{ fontFamily: "var(--wt-font-mono)", fontSize: 12 }}>{g.fromNodeId}</Td>
                  <Td align="right">{g.factCount}</Td>
                  <Td align="right">{new Date(g.appliedAt).toLocaleString()}</Td>
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
    <section
      className={className}
      style={{
        background: "var(--wt-bg-elevated)",
        borderRadius: "var(--wt-radius-md)",
        border: "1px solid var(--wt-border)",
        padding: "20px 24px",
        marginBottom: 0,
      }}
    >
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "var(--wt-text)" }}>{title}</h3>
      {children}
    </section>
  );
}

function BigStat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div
      style={{
        background: "var(--wt-bg)",
        borderRadius: 10,
        padding: "14px 16px",
        border: "1px solid var(--wt-border)",
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--wt-primary)" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--wt-text)", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--wt-text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      style={{
        textAlign: align ?? "left",
        padding: "8px 8px",
        fontWeight: 600,
        fontSize: 12,
        color: "var(--wt-text-muted)",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align, style }: { children: React.ReactNode; align?: "right"; style?: React.CSSProperties }) {
  return <td style={{ padding: "8px 8px", textAlign: align ?? "left", ...style }}>{children}</td>;
}
