"use client";

import Link from "next/link";
import { WikiTravelerLogo } from "@wikitraveler/ui";

const TAB_SUBTITLES: Record<string, string> = {
  search: "Find a property to audit",
  nearby: "Properties near your location",
  recent: "Recently audited",
  settings: "Configuration & account",
};

interface Props {
  region?: string | null;
  showBack?: boolean;
  backHref?: string;
  title?: string;
  subtitle?: string;
  nodeReachable?: boolean | null;
  activeTab?: string;
}

export function FieldKitHeader({
  region,
  showBack,
  backHref = "/",
  title,
  subtitle,
  nodeReachable,
  activeTab,
}: Props) {
  const statusDot =
    nodeReachable === true
      ? { bg: "#34d399", title: "Node connected" }
      : nodeReachable === false
      ? { bg: "#f87171", title: "Node unreachable" }
      : null;

  const resolvedSubtitle =
    subtitle ?? (region ? `📡 ${region}` : activeTab ? TAB_SUBTITLES[activeTab] : undefined);

  return (
    <header
      style={{
        background: "var(--wt-bg-header)",
        color: "var(--wt-primary-contrast)",
        padding: "10px 16px",
        paddingTop: "max(10px, env(safe-area-inset-top))",
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "sticky",
        top: 0,
        zIndex: 20,
        minHeight: 56,
      }}
    >
      {showBack && (
        <Link
          href={backHref}
          style={{
            color: "inherit",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 14,
            fontWeight: 600,
            flexShrink: 0,
            textDecoration: "none",
            opacity: 0.9,
            padding: "6px 2px",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </Link>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {title ? (
          <>
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </p>
            {resolvedSubtitle && (
              <p style={{ fontSize: 12, opacity: 0.72, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {resolvedSubtitle}
              </p>
            )}
          </>
        ) : (
          <>
            <WikiTravelerLogo product="field-kit" size={22} />
            {resolvedSubtitle && (
              <p style={{ fontSize: 11, opacity: 0.72, marginTop: 3 }}>{resolvedSubtitle}</p>
            )}
          </>
        )}
      </div>

      {statusDot && (
        <div
          title={statusDot.title}
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: statusDot.bg,
            flexShrink: 0,
            boxShadow: `0 0 0 2px rgba(255,255,255,0.25)`,
          }}
        />
      )}
    </header>
  );
}
