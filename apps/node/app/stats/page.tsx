import { NODE_ID, NODE_VERSION } from "@/lib/nodeInfo";
import { getNodeRegionLabel } from "@/lib/nodeSettings";
import { NodeAppShell } from "../NodeAppShell";
import { AdminPageContent } from "./AdminPageContent";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const region = await getNodeRegionLabel();

  return (
    <NodeAppShell lead={`${region} · ${NODE_ID} · v${NODE_VERSION}`} activeNav="stats">
      <AdminPageContent />
    </NodeAppShell>
  );
}
