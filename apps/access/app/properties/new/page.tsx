"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AccessToolbar } from "../../AccessToolbar";
import { CreatePropertyPanel } from "../../tabs/CreatePropertyPanel";
import { useNodeContext } from "../../hooks/useNodeContext";
import { readAuthToken } from "../../lib/authStorage";
import { canContribute, roleFromToken } from "../../lib/userRole";

export default function NewPropertyPage() {
  const router = useRouter();
  const { nodeUrl, searchNodeUrl } = useNodeContext();

  useEffect(() => {
    const token = readAuthToken();
    if (!canContribute(roleFromToken(token))) {
      router.replace("/");
    }
  }, [router]);

  function handleCreated(id: string) {
    const nodeParam =
      searchNodeUrl !== nodeUrl ? `?node=${encodeURIComponent(searchNodeUrl)}` : "";
    router.push(`/audit/${id}${nodeParam}`);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--wt-bg)" }}>
      <AccessToolbar title="New property" showBack backHref="/" />
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
