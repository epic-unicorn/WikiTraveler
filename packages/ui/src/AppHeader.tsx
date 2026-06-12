"use client";

import type { ReactNode } from "react";
import { WikiTravelerLogo } from "./logos/WikiTravelerLogo";
import { ThemeToggle } from "./ThemeToggle";

export interface AppHeaderProps {
  product: "node" | "field-kit" | "lens";
  subtitle?: string;
  homeHref?: string;
  homeElement?: ReactNode;
  /** Rendered below the logo/subtitle on the left side */
  stats?: ReactNode;
  actions?: ReactNode;
  nav?: ReactNode;
}

export function AppHeader({
  product,
  subtitle,
  homeHref,
  homeElement,
  stats,
  actions,
  nav,
}: AppHeaderProps) {
  const logo = <WikiTravelerLogo product={product} size={26} />;

  return (
    <header
      style={{
        background: "var(--wt-bg-header)",
        color: "var(--wt-primary-contrast)",
        padding: "12px 20px",
        position: "sticky",
        top: 0,
        zIndex: 50,
        boxShadow: "0 1px 0 rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        {/* Left: logo + subtitle + stats */}
        <div style={{ minWidth: 0, flex: 1 }}>
          {homeElement ?? (
            homeHref ? (
              <a href={homeHref} style={{ color: "inherit", textDecoration: "none" }}>
                {logo}
              </a>
            ) : (
              logo
            )
          )}
          {subtitle && (
            <p
              style={{
                fontSize: 11,
                opacity: 0.7,
                marginTop: 3,
                marginBottom: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </p>
          )}
          {stats && (
            <div style={{ marginTop: 4 }}>
              {stats}
            </div>
          )}
        </div>

        {/* Right: nav + theme toggle + actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          {nav}
          <ThemeToggle compact />
          {actions}
        </div>
      </div>
    </header>
  );
}
