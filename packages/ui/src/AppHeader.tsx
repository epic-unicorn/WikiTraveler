"use client";

import type { ReactNode } from "react";
import { WikiTravelerLogo } from "./logos/WikiTravelerLogo";
import { ThemeToggle } from "./ThemeToggle";

export interface AppHeaderProps {
  product: "node" | "field-kit" | "lens";
  subtitle?: string;
  homeHref?: string;
  homeElement?: ReactNode;
  actions?: ReactNode;
  nav?: ReactNode;
}

export function AppHeader({
  product,
  subtitle,
  homeHref,
  homeElement,
  actions,
  nav,
}: AppHeaderProps) {
  const logo = <WikiTravelerLogo product={product} size={22} />;

  return (
    <header
      style={{
        background: "var(--wt-bg-header)",
        color: "var(--wt-bg-header-contrast)",
        padding: "0 20px",
        minHeight: 52,
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 1px 0 rgba(0,0,0,0.14)",
      }}
    >
      {/* Left: logo + optional subtitle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {homeElement ?? (
          homeHref ? (
            <a
              href={homeHref}
              style={{ color: "inherit", textDecoration: "none", display: "flex", alignItems: "center" }}
            >
              {logo}
            </a>
          ) : (
            logo
          )
        )}
        {subtitle && (
          <span
            style={{
              fontSize: 11,
              opacity: 0.55,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 180,
            }}
          >
            {subtitle}
          </span>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right: nav + theme toggle + actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexShrink: 0,
        }}
      >
        {nav}
        {nav && (
          <span
            style={{
              width: 1,
              height: 16,
              background: "rgba(255,255,255,0.18)",
              margin: "0 6px",
              flexShrink: 0,
            }}
          />
        )}
        <ThemeToggle compact />
        {actions && (
          <span
            style={{
              width: 1,
              height: 16,
              background: "rgba(255,255,255,0.18)",
              margin: "0 6px",
              flexShrink: 0,
            }}
          />
        )}
        {actions}
      </div>
    </header>
  );
}
