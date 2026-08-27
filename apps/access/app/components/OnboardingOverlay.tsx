"use client";

import { useEffect, useState } from "react";
import { useLocale, WikiTravelerLogo } from "@wikitraveler/ui";

const STORAGE_KEY = "wt_access_onboarding_done";

export function OnboardingOverlay() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "1") setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function finish() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fk-onboarding" role="dialog" aria-modal="true" aria-labelledby="fk-onboarding-title">
      <div className="fk-onboarding__card">
        <WikiTravelerLogo product="access" size={40} />
        <h2 id="fk-onboarding-title">{t("ui.onboardingTitle")}</h2>
        <p className="fk-page-subtitle">{t("ui.onboardingBody")}</p>
        <button type="button" className="btn-primary" onClick={finish}>
          {t("ui.onboardingTraveler")}
        </button>
        <button type="button" className="btn-secondary" onClick={finish}>
          {t("ui.onboardingAuditor")}
        </button>
        <button type="button" className="btn-secondary" onClick={finish}>
          {t("ui.onboardingSkip")}
        </button>
      </div>
    </div>
  );
}
