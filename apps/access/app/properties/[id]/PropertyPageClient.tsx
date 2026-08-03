"use client";

import nextDynamic from "next/dynamic";
import { Suspense, use } from "react";

const PropertyDetail = nextDynamic(
  () => import("./PropertyDetail").then((m) => m.PropertyDetail),
  { ssr: false, loading: () => <div className="page" style={{ padding: 24 }}>Loading…</div> }
);

export function PropertyPageClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense>
      <PropertyDetail propertyId={id} />
    </Suspense>
  );
}
