import { PropertyPageClient } from "./PropertyPageClient";

export const dynamic = "force-dynamic";

export default function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PropertyPageClient params={params} />;
}
