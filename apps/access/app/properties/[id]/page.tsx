import nextDynamic from "next/dynamic";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

const PropertyDetail = nextDynamic(
  () => import("./PropertyDetail").then((m) => m.PropertyDetail),
  { ssr: false, loading: () => <div className="page" style={{ padding: 24 }}>Loading…</div> }
);

export default function PropertyPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <PropertyDetail propertyId={params.id} />
    </Suspense>
  );
}
