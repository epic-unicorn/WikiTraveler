"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AppShell,
  AppToolbar,
  PageLead,
  WikiTravelerLogo,
  ThemeToggle,
  LocalePicker,
  useLocale,
  type ToolbarLink,
} from "@wikitraveler/ui";
import { SignOutButton } from "./SignOutButton";
import { useOpenSignalsBadgeCount } from "./hooks/useOpenSignalsBadgeCount";

interface Props {
  lead?: string;
  activeNav?: "map" | "signals" | "stats";
  children: React.ReactNode;
  maxWidth?: number;
}

function useNavLinks(activeNav: "map" | "signals" | "stats"): ToolbarLink[] {
  const { t } = useLocale();
  const openSignals = useOpenSignalsBadgeCount(true);

  return [
    { href: "/", label: t("ui.navMap"), active: activeNav === "map" },
    {
      href: "/signals",
      label: t("ui.navSignals"),
      active: activeNav === "signals",
      badgeCount: openSignals,
      ariaLabel:
        openSignals > 0 ? t("ui.signalsNavBadge", { count: openSignals }) : undefined,
    },
    { href: "/stats", label: t("ui.navStats"), active: activeNav === "stats" },
  ];
}

function nodeLinkWrap({
  href,
  className,
  children,
  external,
  ariaLabel,
}: {
  href: string;
  className: string;
  children: ReactNode;
  external?: boolean;
  ariaLabel?: string;
}) {
  if (external) {
    return (
      <a
        href={href}
        className={className}
        aria-label={ariaLabel}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}

export function NodeAppShell({
  lead,
  activeNav = "map",
  children,
  maxWidth = 1280,
}: Props) {
  const navLinks = useNavLinks(activeNav);
  const { t } = useLocale();

  return (
    <AppShell
      maxWidth={maxWidth}
      header={
        <AppToolbar
          title={<WikiTravelerLogo product="node" size={32} />}
          titleHref="/"
          links={navLinks}
          linkWrap={nodeLinkWrap}
          end={
            <>
              <LocalePicker compact />
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
          {t("ui.navAccessibilityStatement")}
        </Link>
      </footer>
    </AppShell>
  );
}
