import { prisma } from "@/lib/prisma";
import { NODE_ID, NODE_VERSION, NODE_REGION } from "@/lib/nodeInfo";
import { SearchMapLayout } from "./SearchMapLayout";
import { NodeAppShell } from "./NodeAppShell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [propertyCount, peerCount, factCount] = await Promise.all([
    prisma.property.count(),
    prisma.nodePeer.count({ where: { isActive: true } }),
    prisma.accessibilityFact.count(),
  ]);

  return (
    <NodeAppShell
      subtitle={`${NODE_REGION} · ${NODE_ID} · v${NODE_VERSION}`}
      activeNav="map"
    >
      <SearchMapLayout
        propertyCount={propertyCount}
        factCount={factCount}
        peerCount={peerCount}
      />
    </NodeAppShell>
  );
}
