import nextDynamic from "next/dynamic";

export const dynamic = "force-dynamic";

const AccessTabs = nextDynamic(
  () => import("./AccessTabs").then((m) => m.AccessTabs),
  { ssr: false, loading: () => <div className="page" style={{ padding: 24 }}>Loading…</div> }
);

export default function HomePage() {
  return <AccessTabs />;
}
