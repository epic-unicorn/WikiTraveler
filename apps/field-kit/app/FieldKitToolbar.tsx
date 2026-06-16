"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AppToolbar, ToolbarBackLink, WikiTravelerLogo } from "@wikitraveler/ui";

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
  nodeReachable?: boolean | null;
  end?: ReactNode;
}

export function FieldKitToolbar({
  title,
  showBack,
  backHref = "/",
  backLabel,
  nodeReachable,
  end,
}: Props) {
  const statusDot =
    nodeReachable === true
      ? { bg: "#34d399", label: "Node connected" }
      : nodeReachable === false
      ? { bg: "#f87171", label: "Node unreachable" }
      : null;

  const toolbarEnd = (
    <>
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
      className="wt-toolbar--field-kit"
      title={title ?? <WikiTravelerLogo product="field-kit" size={32} />}
      titleHref={title ? undefined : "/"}
      linkWrap={fkLinkWrap}
      start={
        showBack ? <ToolbarBackLink href={backHref} label={backLabel} linkWrap={fkLinkWrap} /> : undefined
      }
      end={toolbarEnd}
    />
  );
}
