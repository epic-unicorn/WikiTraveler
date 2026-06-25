"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@wikitraveler/ui";
import { AccessToolbar } from "../../AccessToolbar";
import { HistoryBackButton } from "../../lib/historyBack";
import { CreatePropertyPanel } from "../../tabs/CreatePropertyPanel";
import { useNodeContext } from "../../hooks/useNodeContext";
import { readAuthToken } from "../../lib/authStorage";
import { canContribute, roleFromToken } from "../../lib/userRole";

export default function NewPropertyPage() {
  const router = useRouter();
  const { t } = useLocale();
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
    <div className="fk-shell">
      <AccessToolbar />
      <main className="page fk-main">
        <div className="fk-property-lead">
          <HistoryBackButton />
          <h1 className="fk-property-title">{t("ui.addProperty")}</h1>
          <p className="fk-property-location">{t("ui.contributeBody")}</p>
        </div>
        <CreatePropertyPanel
          searchNodeUrl={searchNodeUrl}
          homeNodeUrl={nodeUrl}
          onCreated={handleCreated}
        />
      </main>
    </div>
  );
}
