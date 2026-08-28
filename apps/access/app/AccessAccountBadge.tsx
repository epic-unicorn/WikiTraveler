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

function displayName(username: string): { name: string; subtitle: string | null } {
  if (username.includes("@")) {
    const local = username.split("@")[0] ?? username;
    const pretty = local.charAt(0).toUpperCase() + local.slice(1);
    return { name: pretty, subtitle: username };
  }
  return { name: username, subtitle: null };
}

interface Props {
  compact?: boolean;
  variant?: "toolbar" | "card" | "hero";
  onSignOut?: () => void;
}

export function AccessAccountBadge({ compact = true, variant, onSignOut }: Props) {
  const { t } = useLocale();
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole>("USER");
  const resolvedVariant = variant ?? (compact ? "toolbar" : "card");

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
  const { name, subtitle } = displayName(username);
  const initial = name.charAt(0).toUpperCase();

  if (resolvedVariant === "hero") {
    return (
      <div className="fk-profile-identity">
        <span className="fk-profile-identity__avatar" aria-hidden="true">
          {initial}
        </span>
        <div className="fk-profile-identity__text">
          <div className="fk-profile-identity__name-row">
            <p className="fk-profile-identity__name">{name}</p>
            <span className={`wt-access-account__role wt-access-account__role--${role.toLowerCase()}`}>
              {roleLabel}
            </span>
          </div>
          {subtitle && <p className="fk-profile-identity__email">{subtitle}</p>}
        </div>
        {onSignOut && (
          <button type="button" className="fk-profile-identity__logout" onClick={onSignOut}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {t("ui.signOut")}
          </button>
        )}
      </div>
    );
  }

  if (resolvedVariant === "card") {
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
      <span className={`wt-access-account__role wt-access-account__role--${role.toLowerCase()}`}>
        {roleLabel}
      </span>
    </div>
  );
}
