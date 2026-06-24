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
  /** Fixed href; omit to use browser history (with fallback). */
  backHref?: string;
  backLabel?: string;
  backFallbackHref?: string;
  nodeReachable?: boolean | null;
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

export function AccessToolbar({
  title,
  showBack,
  backHref,
  backLabel,
  backFallbackHref = "/",
  nodeReachable,
  end,
}: Props) {
  const { t } = useLocale();
  const statusDot =
    nodeReachable === true
      ? { bg: "#34d399", label: "Node connected" }
      : nodeReachable === false
      ? { bg: "#f87171", label: "Node unreachable" }
      : null;

  const toolbarEnd = (
    <>
      <AccessAccountBadge />
      {statusDot && (
        <div
          title={statusDot.label}
          aria-label={statusDot.label}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: statusDot.bg,
            boxShadow: "0 0 0 2px rgba(255,255,255,0.2)",
            flexShrink: 0,
            marginRight: 4,
          }}
        />
      )}
      {end}
    </>
  );

  return (
    <AppToolbar
      className="wt-toolbar--access"
      title={title ?? <WikiTravelerLogo product="access" size={32} />}
      titleHref={title ? undefined : "/"}
      linkWrap={fkLinkWrap}
      start={
        showBack ? (
          backHref ? (
            <ToolbarBackLink href={backHref} label={backLabel ?? t("ui.back")} linkWrap={fkLinkWrap} />
          ) : (
            <AccessHistoryBack
              label={backLabel ?? t("ui.back")}
              fallbackHref={backFallbackHref}
            />
          )
        ) : undefined
      }
      end={toolbarEnd}
    />
  );
}
