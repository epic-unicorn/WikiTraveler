import nextDynamic from "next/dynamic";

export const dynamic = "force-dynamic";

const FieldKitTabs = nextDynamic(
  () => import("./FieldKitTabs").then((m) => m.FieldKitTabs),
  { ssr: false, loading: () => <div className="page" style={{ padding: 24 }}>Loading…</div> }
);

export default function HomePage() {
  return <FieldKitTabs />;
}
