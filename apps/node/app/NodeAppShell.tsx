"use client";

import Link from "next/link";
import { AppHeader, AppShell, WikiTravelerLogo } from "@wikitraveler/ui";
import { SignOutButton } from "./SignOutButton";

// ── Shared header pill style ──────────────────────────────────────────────────
// Every interactive element in the header uses this base. The only variation
// is the fill opacity, which indicates active state.

const PILL_BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 13,
  lineHeight: 1,
  borderRadius: 7,
  padding: "5px 10px",
  textDecoration: "none",
  whiteSpace: "nowrap",
  transition: "opacity 0.12s",
};

/** Resting state — used by inactive nav, ThemeToggle, SignOut */
export const PILL_REST: React.CSSProperties = {
  ...PILL_BASE,
  fontWeight: 500,
  color: "rgba(255,255,255,0.82)",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.16)",
};

/** Active state — current nav destination */
const PILL_ACTIVE: React.CSSProperties = {
  ...PILL_BASE,
  fontWeight: 600,
  color: "#ffffff",
  background: "rgba(255,255,255,0.22)",
  border: "1px solid rgba(255,255,255,0.28)",
};

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  subtitle?: string;
  activeNav?: "map" | "stats";
  children: React.ReactNode;
  maxWidth?: number;
}

export function NodeAppShell({
  subtitle,
  activeNav = "map",
  children,
  maxWidth,
}: Props) {
  const nav = (
    <nav style={{ display: "flex", alignItems: "center", gap: 4 }} aria-label="Main navigation">
      <NavLink href="/" active={activeNav === "map"}>Map</NavLink>
      <NavLink href="/stats" active={activeNav === "stats"}>Stats</NavLink>
      <AddPropertyLink />
    </nav>
  );

  return (
    <AppShell
      maxWidth={maxWidth}
      header={
        <AppHeader
          product="node"
          subtitle={subtitle}
          homeElement={
            <Link href="/" style={{ color: "inherit", textDecoration: "none", display: "flex", alignItems: "center" }}>
              <WikiTravelerLogo product="node" size={22} />
            </Link>
          }
          nav={nav}
          actions={<SignOutButton />}
        />
      }
    >
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

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} style={active ? PILL_ACTIVE : PILL_REST}>
      {children}
    </Link>
  );
}

function AddPropertyLink() {
  return (
    <Link href="/properties/new" style={{ ...PILL_REST, marginLeft: 4 }}>
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Property
    </Link>
  );
}
