"use client";

import Link from "next/link";
import { AppHeader, AppShell, WikiTravelerLogo } from "@wikitraveler/ui";
import { SignOutButton } from "./SignOutButton";

interface StatItem {
  label: string;
  value: number;
}

interface Props {
  subtitle?: string;
  stats?: StatItem[];
  activeNav?: "map" | "stats";
  children: React.ReactNode;
  maxWidth?: number;
}

export function NodeAppShell({
  subtitle,
  stats,
  activeNav = "map",
  children,
  maxWidth,
}: Props) {
  const statNodes =
    stats && stats.length > 0 ? (
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {stats.map((s, i) => (
          <span
            key={s.label}
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.65)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {i > 0 && (
              <span style={{ opacity: 0.3, marginRight: 2 }}>·</span>
            )}
            <strong style={{ color: "rgba(255,255,255,0.95)", fontWeight: 700, fontSize: 13 }}>
              {s.value.toLocaleString()}
            </strong>
            {" "}{s.label.toLowerCase()}
          </span>
        ))}
      </div>
    ) : null;

  const nav = (
    <nav style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <NavLink href="/" active={activeNav === "map"}>Map</NavLink>
      <NavLink href="/stats" active={activeNav === "stats"}>Stats</NavLink>
      <NavLink href="/properties/new" active={false} highlight>
        + Property
      </NavLink>
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
            <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
              <WikiTravelerLogo product="node" size={26} />
            </Link>
          }
          stats={statNodes}
          nav={nav}
          actions={<SignOutButton />}
        />
      }
    >
      {children}
    </AppShell>
  );
}

function NavLink({
  href,
  active,
  highlight,
  children,
}: {
  href: string;
  active: boolean;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        fontSize: 13,
        fontWeight: 600,
        padding: "5px 11px",
        borderRadius: 8,
        textDecoration: "none",
        transition: "background 0.15s, color 0.15s",
        color: active
          ? "#ffffff"
          : highlight
          ? "rgba(255,255,255,0.95)"
          : "rgba(255,255,255,0.72)",
        background: active
          ? "rgba(255,255,255,0.2)"
          : highlight
          ? "rgba(255,255,255,0.1)"
          : "transparent",
        border: highlight && !active ? "1px solid rgba(255,255,255,0.25)" : "1px solid transparent",
      }}
    >
      {children}
    </Link>
  );
}
