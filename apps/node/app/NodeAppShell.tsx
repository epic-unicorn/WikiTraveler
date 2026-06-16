"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AppShell,
  AppToolbar,
  PageLead,
  WikiTravelerLogo,
  ThemeToggle,
  type ToolbarLink,
} from "@wikitraveler/ui";
import { SignOutButton } from "./SignOutButton";

interface Props {
  lead?: string;
  activeNav?: "map" | "stats";
  children: React.ReactNode;
  maxWidth?: number;
}

const NAV_LINKS = (activeNav: "map" | "stats"): ToolbarLink[] => [
  { href: "/", label: "Map", active: activeNav === "map" },
  { href: "/stats", label: "Stats", active: activeNav === "stats" },
  { href: "/properties/new", label: "+ Property" },
];

function nodeLinkWrap({
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

export function NodeAppShell({
  lead,
  activeNav = "map",
  children,
  maxWidth,
}: Props) {
  return (
    <AppShell
      maxWidth={maxWidth}
      header={
        <AppToolbar
          title={<WikiTravelerLogo product="node" size={32} />}
          titleHref="/"
          links={NAV_LINKS(activeNav)}
          linkWrap={nodeLinkWrap}
          end={
            <>
              <ThemeToggle compact variant="toolbar" />
              <SignOutButton />
            </>
          }
        />
      }
    >
      {lead && <PageLead>{lead}</PageLead>}
      {children}
      <footer
        style={{
          marginTop: 48,
          paddingTop: 16,
          borderTop: "1px solid var(--wt-border)",
          fontSize: 12,
          color: "var(--wt-text-muted)",
        }}
      >
        <Link href="/accessibility" style={{ color: "var(--wt-primary)", textDecoration: "none" }}>
          Accessibility statement
        </Link>
      </footer>
    </AppShell>
  );
}
