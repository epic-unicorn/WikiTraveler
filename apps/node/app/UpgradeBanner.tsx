"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@wikitraveler/ui";
import type { UpgradeAssessment } from "@wikitraveler/core";

type UpgradePayload = {
  currentVersion: string;
  manifest: { latest: string; minRecommended: string; releasedAt?: string | null } | null;
  upgrade: UpgradeAssessment;
};

export function UpgradeBanner({ token }: { token: string }) {
  const { t } = useLocale();
  const [data, setData] = useState<UpgradePayload | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/upgrade-status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setData((await res.json()) as UpgradePayload);
    } catch {
      // advisory only — ignore fetch errors
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data?.upgrade.message) return null;

  const bannerClass =
    data.upgrade.level === "warn"
      ? "wt-admin-banner wt-admin-banner--warn"
      : "wt-admin-banner wt-admin-banner--info";

  return (
    <div className={bannerClass} role="status">
      <strong>{t("ui.adminUpgradeTitle")}</strong>
      <span className="wt-admin-muted"> {data.upgrade.message}</span>
      {data.upgrade.latest && (
        <span className="wt-admin-muted">
          {" "}
          {t("ui.adminUpgradeLatest", { version: data.upgrade.latest })}
        </span>
      )}
    </div>
  );
}
