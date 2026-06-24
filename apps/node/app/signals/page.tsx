import { NodeAppShell } from "../NodeAppShell";
import { SignalsPageContent } from "./SignalsPageContent";

export const dynamic = "force-dynamic";

export default function SignalsPage() {
  return (
    <NodeAppShell activeNav="signals" maxWidth={960}>
      <SignalsPageContent />
    </NodeAppShell>
  );
}
