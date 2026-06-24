"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@wikitraveler/ui";
import { readAuthToken, readUsername, type AppRole } from "./lib/authStorage";
import { decodeJwtPayload, roleFromToken } from "./lib/userRole";

const ROLE_LABEL_KEY: Record<AppRole, string> = {
  USER: "ui.accessRoleUser",
  AUDITOR: "ui.accessRoleAuditor",
  ADMIN: "ui.accessRoleAdmin",
};

export function AccessAccountBadge({ compact = true }: { compact?: boolean }) {
  const { t } = useLocale();
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole>("USER");

  useEffect(() => {
    const token = readAuthToken();
    const stored = readUsername();
    const fromToken = token
      ? ((decodeJwtPayload(token)?.sub as string | undefined)?.trim().toLowerCase() ?? null)
      : null;
    setUsername(stored ?? fromToken);
    setRole(roleFromToken(token));
  }, []);

  if (!username) return null;

  const roleLabel = t(ROLE_LABEL_KEY[role]);

  if (!compact) {
    return (
      <div className="wt-access-account wt-access-account--card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <p className="wt-access-account__name">{username}</p>
          <span className={`wt-access-account__role wt-access-account__role--${role.toLowerCase()}`}>
            {roleLabel}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="wt-access-account"
      title={t("ui.accessAccountSummary", { user: username, role: roleLabel })}
      aria-label={t("ui.accessAccountSummary", { user: username, role: roleLabel })}
    >
      <span className="wt-access-account__name">{username}</span>
      <span className={`wt-access-account__role wt-access-account__role--${role.toLowerCase()}`}>
        {roleLabel}
      </span>
    </div>
  );
}
