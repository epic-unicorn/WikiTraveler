"use client";

import { useState } from "react";
import { useLocale } from "@wikitraveler/ui";
import { RecentPropertiesSection } from "../components/RecentPropertiesSection";
import { readRecentAudits } from "../lib/recentAudits";

interface Props {
  homeNodeUrl: string;
}

export function RecentTab({ homeNodeUrl }: Props) {
  const { t } = useLocale();
  const [itemCount, setItemCount] = useState(() => readRecentAudits().length);

  if (itemCount === 0) {
    return (
      <div className="fk-empty" style={{ paddingTop: 48 }}>
        <span className="fk-empty-icon">📋</span>
        <p className="fk-empty-title">{t("ui.recentEmpty")}</p>
        <p className="fk-empty-body">{t("ui.recentEmptyBody")}</p>
      </div>
    );
  }

  return (
    <div className="tab-content" style={{ paddingTop: 16 }}>
      <RecentPropertiesSection
        homeNodeUrl={homeNodeUrl}
        onItemsChange={setItemCount}
        showClear
      />
    </div>
  );
}
