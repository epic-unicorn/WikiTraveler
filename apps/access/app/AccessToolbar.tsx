"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AppToolbar, ToolbarBackLink, WikiTravelerLogo, useLocale } from "@wikitraveler/ui";
import { AccessAccountBadge } from "./AccessAccountBadge";
import { useHistoryBack } from "./lib/historyBack";

function fkLinkWrap({
  href,
  className,
  children,
  external,
}: {
  href: string;
  className: string;
  children: ReactNode;
  external?: boolean;
}) {
  if (external) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

interface Props {
  title?: string;
  showBack?: boolean;
  backHref?: string;
  backLabel?: string;
  backFallbackHref?: string;
  nodeReachable?: boolean | null;
  nodeRegion?: string | null;
  end?: ReactNode;
}

function AccessHistoryBack({
  label,
  fallbackHref,
}: {
  label: string;
  fallbackHref: string;
}) {
  const goBack = useHistoryBack(fallbackHref);

  return (
    <button type="button" className="wt-toolbar-back" onClick={goBack}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {label}
    </button>
  );
}

function NodeStatusChip({
  reachable,
  region,
}: {
  reachable: boolean | null;
  region?: string | null;
}) {
  const { t } = useLocale();
  if (reachable === null) {
    return (
      <span className="fk-node-status fk-node-status--checking" title={t("ui.checking")}>
        <span className="fk-node-status__dot" aria-hidden="true" />
        <span className="fk-node-status__label">{t("ui.checking")}</span>
      </span>
    );
  }
  if (!reachable) {
    return (
      <span className="fk-node-status fk-node-status--err" title={t("ui.unreachable")}>
        <span className="fk-node-status__dot" aria-hidden="true" />
        <span className="fk-node-status__label">{t("ui.unreachable")}</span>
      </span>
    );
  }
  const label = region?.trim() || t("ui.connected");
  return (
    <span className="fk-node-status fk-node-status--ok" title={label}>
      <span className="fk-node-status__dot" aria-hidden="true" />
      <span className="fk-node-status__label">{label}</span>
    </span>
  );
}

export function AccessToolbar({
  title,
  showBack,
  backHref,
  backLabel,
  backFallbackHref = "/",
  nodeReachable,
  nodeRegion,
  end,
}: Props) {
  const { t } = useLocale();

  const start = showBack ? (
    backHref ? (
      <ToolbarBackLink href={backHref} label={backLabel ?? t("ui.back")} linkWrap={fkLinkWrap} />
    ) : (
      <AccessHistoryBack label={backLabel ?? t("ui.back")} fallbackHref={backFallbackHref} />
    )
  ) : undefined;

  return (
    <AppToolbar
      className="wt-toolbar--access"
      title={
        title ?? (
          <WikiTravelerLogo product="access" size={26} className="wt-logo--access-toolbar" />
        )
      }
      titleHref={title ? undefined : "/"}
      linkWrap={fkLinkWrap}
      start={start}
      end={
        <div className="fk-toolbar-end">
          <NodeStatusChip reachable={nodeReachable ?? null} region={nodeRegion} />
          <AccessAccountBadge />
          {end}
        </div>
      }
    />
  );
}
