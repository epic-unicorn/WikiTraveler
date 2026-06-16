"use client";

import { useLocale } from "@wikitraveler/ui";

export function SignOutButton() {
  const { t } = useLocale();

  function signOut() {
    document.cookie = "wt_token=; path=/; max-age=0";
    sessionStorage.removeItem("wt_node_token");
    window.location.href = "/login";
  }

  return (
    <button type="button" onClick={signOut} className="wt-toolbar-btn" title={t("ui.signOut")} aria-label={t("ui.signOut")}>
      {t("ui.signOut")}
    </button>
  );
}
