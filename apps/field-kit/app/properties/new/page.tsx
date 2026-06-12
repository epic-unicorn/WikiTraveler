"use client";

import { useRouter } from "next/navigation";
import { FieldKitHeader } from "../../FieldKitHeader";
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
      <FieldKitHeader
        title="New property"
        subtitle="Add a place to the network"
        showBack
        backHref="/"
      />
      <div className="page" style={{ paddingTop: 20 }}>
        <CreatePropertyPanel
          searchNodeUrl={searchNodeUrl}
          homeNodeUrl={nodeUrl}
          onCreated={handleCreated}
        />
      </div>
    </div>
  );
}
