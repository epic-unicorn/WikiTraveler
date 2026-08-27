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
  /** @deprecated Region chip removed — kept for call-site compatibility. */
  nodeRegion?: string | null;
  /** Account/role chip in the toolbar end (default true). */
  showAccount?: boolean;
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

function NodeStatusChip({ reachable }: { reachable: boolean | null }) {
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
  return (
    <span className="fk-node-status fk-node-status--ok" title={t("ui.connected")}>
      <span className="fk-node-status__dot" aria-hidden="true" />
      <span className="fk-node-status__label">{t("ui.connected")}</span>
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
  showAccount = true,
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

  const endContent =
    nodeReachable !== undefined || showAccount || end ? (
      <div className="fk-toolbar-end">
        {nodeReachable !== undefined && (
          <NodeStatusChip reachable={nodeReachable ?? null} />
        )}
        {showAccount && <AccessAccountBadge />}
        {end}
      </div>
    ) : undefined;

  const titleContent =
    title === undefined ? (
      <WikiTravelerLogo product="access" size={26} className="wt-logo--access-toolbar" />
    ) : typeof title === "string" ? (
      <span className="fk-toolbar-page-title">{title}</span>
    ) : (
      title
    );

  return (
    <AppToolbar
      className="wt-toolbar--access"
      title={titleContent}
      titleHref={title === undefined ? "/" : undefined}
      linkWrap={fkLinkWrap}
      start={start}
      end={endContent}
    />
  );
}
