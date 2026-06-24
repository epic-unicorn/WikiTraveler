"use client";

import { useRouter } from "next/navigation";
import { FieldKitToolbar } from "../../FieldKitToolbar";
import { CreatePropertyPanel } from "../../tabs/CreatePropertyPanel";
import { useNodeContext } from "../../hooks/useNodeContext";

export default function NewPropertyPage() {
  const router = useRouter();
  const { nodeUrl, searchNodeUrl } = useNodeContext();

  function handleCreated(id: string) {
    const nodeParam =
      searchNodeUrl !== nodeUrl ? `?node=${encodeURIComponent(searchNodeUrl)}` : "";
    router.push(`/audit/${id}${nodeParam}`);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--wt-bg)" }}>
      <FieldKitToolbar title="New property" showBack backHref="/" />
      <div className="page" style={{ paddingTop: 20 }}>
        <p className="wt-fk-page-lead">Add a place to the network</p>
        <CreatePropertyPanel
          searchNodeUrl={searchNodeUrl}
          homeNodeUrl={nodeUrl}
          onCreated={handleCreated}
        />
      </div>
    </div>
  );
}
