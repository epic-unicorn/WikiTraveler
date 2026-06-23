import { prisma } from "@/lib/prisma";
import { NODE_ID, NODE_VERSION } from "@/lib/nodeInfo";
import { getNodeRegionLabel, getNodeSettings } from "@/lib/nodeSettings";
import { SearchMapLayout } from "./SearchMapLayout";
import { NodeAppShell } from "./NodeAppShell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [propertyCount, peerCount, factCount, settings, region] = await Promise.all([
    prisma.property.count(),
    prisma.nodePeer.count({ where: { isActive: true } }),
    prisma.accessibilityFact.count(),
    getNodeSettings(),
    getNodeRegionLabel(),
  ]);

  return (
    <NodeAppShell
      lead={`${region} · ${NODE_ID} · v${NODE_VERSION}`}
      activeNav="map"
    >
      <SearchMapLayout
        propertyCount={propertyCount}
        factCount={factCount}
        peerCount={peerCount}
        regionConfigured={settings.isConfigured}
      />
    </NodeAppShell>
  );
}
