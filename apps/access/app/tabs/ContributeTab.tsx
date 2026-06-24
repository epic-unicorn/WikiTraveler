"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@wikitraveler/ui";
import { fetchContributorStats } from "../lib/accessApi";

interface Props {
  homeNodeUrl: string;
}

export function ContributeTab({ homeNodeUrl }: Props) {
  const { t } = useLocale();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchContributorStats>>>(null);

  useEffect(() => {
    fetchContributorStats(homeNodeUrl).then(setStats);
  }, [homeNodeUrl]);

  return (
    <div className="tab-content" style={{ paddingTop: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>{t("ui.contributeTitle")}</h2>
      <p style={{ fontSize: 13, color: "var(--wt-text-muted)", marginBottom: 20 }}>
        {t("ui.contributeBody")}
      </p>

      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <StatCard label={t("ui.contributeAudits")} value={stats.auditsSubmitted} />
          <StatCard label={t("ui.contributeReports")} value={stats.signals.submitted} />
          <StatCard label={t("ui.contributeResolved")} value={stats.signals.resolved} />
        </div>
      )}

      <Link
        href="/properties/new"
        className="btn-primary"
        style={{ display: "block", textAlign: "center", textDecoration: "none", marginBottom: 12 }}
      >
        {t("ui.addProperty")}
      </Link>

      <p style={{ fontSize: 12, color: "var(--wt-text-muted)" }}>
        {t("ui.contributeQueueHint")}{" "}
        <a href={`${homeNodeUrl.replace(/\/$/, "")}/signals`} style={{ color: "var(--wt-primary)" }}>
          {t("ui.navSignals")}
        </a>
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid var(--wt-border)",
        borderRadius: 10,
        padding: "12px 10px",
        textAlign: "center",
        background: "var(--wt-bg-elevated)",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--wt-text-muted)", marginTop: 4 }}>{label}</div>
    </div>
  );
}
