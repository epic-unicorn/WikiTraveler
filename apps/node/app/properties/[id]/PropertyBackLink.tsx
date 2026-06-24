"use client";

import { HistoryBackButton } from "../../lib/historyBack";

export function PropertyBackLink({ fallbackHref = "/" }: { fallbackHref?: string }) {
  return <HistoryBackButton fallbackHref={fallbackHref} />;
}
