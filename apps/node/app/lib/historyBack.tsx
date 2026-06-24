"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@wikitraveler/ui";

/** Navigate back in session history, or to a fallback route when opened directly. */
export function useHistoryBack(fallbackHref = "/") {
  const router = useRouter();

  return () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  };
}

export function HistoryBackButton({
  className = "wt-page-back",
  fallbackHref = "/",
}: {
  className?: string;
  fallbackHref?: string;
}) {
  const goBack = useHistoryBack(fallbackHref);
  const { t } = useLocale();

  return (
    <button type="button" onClick={goBack} className={className}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {t("ui.back")}
    </button>
  );
}
