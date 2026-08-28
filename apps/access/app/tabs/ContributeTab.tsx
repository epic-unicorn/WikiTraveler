"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@wikitraveler/ui";
import { fetchContributorStats } from "../lib/accessApi";
import { AccessPageHero } from "../components/AccessPageHero";
import { RecentPropertiesSection } from "../components/RecentPropertiesSection";

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
    <div className="tab-content fk-contribute-tab">
      <AccessPageHero
        notifyNodeUrl={homeNodeUrl}
        sectionTitle={t("ui.contributeTitle")}
        sectionSubtitle={t("ui.contributeSubtitle")}
      />
      <div className="fk-page-body">
        <p className="fk-settings-theme-hint" style={{ marginBottom: 16 }}>
          {t("ui.contributeBody")}
        </p>

        {stats && (
          <div className="fk-contribute-stats">
            <StatCard label={t("ui.contributeAudits")} value={stats.auditsSubmitted} />
            <StatCard label={t("ui.contributeReports")} value={stats.signals.submitted} />
            <StatCard label={t("ui.contributeResolved")} value={stats.signals.resolved} />
          </div>
        )}

        <Link href="/properties/new" className="btn-primary fk-contribute-add">
          {t("ui.addProperty")}
        </Link>

        <RecentPropertiesSection homeNodeUrl={homeNodeUrl} compact maxItems={8} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card fk-contribute-stat">
      <div className="fk-contribute-stat__value">{value}</div>
      <div className="fk-contribute-stat__label">{label}</div>
    </div>
  );
}
