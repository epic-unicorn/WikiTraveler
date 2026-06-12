import { NodeAppShell } from "../../NodeAppShell";
import CreatePropertyPageClient from "./CreatePropertyForm";

export default function NewPropertyPage() {
  return (
    <NodeAppShell activeNav="map" maxWidth={560}>
      <CreatePropertyPageClient />
    </NodeAppShell>
  );
}
