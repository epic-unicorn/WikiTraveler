"use client";

import Link from "next/link";
import { WikiTravelerLogo } from "@wikitraveler/ui";

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

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
      ? { bg: "#34d399", label: "Node connected" }
      : nodeReachable === false
      ? { bg: "#f87171", label: "Node unreachable" }
      : null;

  const resolvedSubtitle =
    subtitle ?? (region ? region : activeTab ? TAB_SUBTITLES[activeTab] : undefined);

  return (
    <header
      style={{
        background: "var(--wt-bg-header)",
        color: "var(--wt-bg-header-contrast)",
        padding: "0 16px",
        paddingTop: "env(safe-area-inset-top, 0px)",
        minHeight: "calc(52px + env(safe-area-inset-top, 0px))",
        display: "flex",
        alignItems: "center",
        gap: 10,
        position: "sticky",
        top: 0,
        zIndex: 20,
        boxShadow: "0 1px 0 rgba(0,0,0,0.14)",
      }}
    >
      {showBack && (
        <Link
          href={backHref}
          style={{
            color: "inherit",
            display: "flex",
            alignItems: "center",
            gap: 3,
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 0,
            textDecoration: "none",
            opacity: 0.88,
            padding: "6px 4px 6px 0",
            minHeight: 44,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </Link>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {title ? (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "8px 0" }}>
            <h1
              style={{
                fontSize: 15,
                fontWeight: 700,
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1.2,
              }}
            >
              {title}
            </h1>
            {resolvedSubtitle && (
              <p
                style={{
                  fontSize: 11,
                  opacity: 0.65,
                  margin: "2px 0 0",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: 1.3,
                }}
              >
                {resolvedSubtitle}
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 className="wt-sr-only">Field Kit</h1>
            <WikiTravelerLogo product="field-kit" size={20} />
            {resolvedSubtitle && (
              <span
                style={{
                  fontSize: 11,
                  opacity: 0.55,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 200,
                }}
              >
                {resolvedSubtitle}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right-side actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {statusDot && (
          <div
            title={statusDot.label}
            aria-label={statusDot.label}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: statusDot.bg,
              boxShadow: `0 0 0 2px rgba(255,255,255,0.2)`,
            }}
          />
        )}
        {!showBack && (
          <Link
            href="/properties/new"
            title="Add new property"
            aria-label="Add new property"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              minWidth: 44,
              minHeight: 44,
              borderRadius: 8,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.22)",
              color: "inherit",
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            <PlusIcon />
          </Link>
        )}
      </div>
    </header>
  );
}
