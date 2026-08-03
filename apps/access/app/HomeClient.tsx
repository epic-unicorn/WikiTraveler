"use client";

import nextDynamic from "next/dynamic";

const AccessTabs = nextDynamic(
  () => import("./AccessTabs").then((m) => m.AccessTabs),
  { ssr: false, loading: () => <div className="page" style={{ padding: 24 }}>Loading…</div> }
);

export function HomeClient() {
  return <AccessTabs />;
}
