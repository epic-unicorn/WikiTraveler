"use client";

import { TierBadge } from "./TierBadge";
import { useLocale } from "./LocaleProvider";

const TIER_RANK: Record<string, number> = {
  OFFICIAL: 0,
  AI_GUESS: 1,
  VERIFIED: 2,
  CONFIRMED: 3,
};

export interface PropertyFact {
  fieldName: string;
  value: string;
  tier: string;
}

export interface PropertySummary {
  id: string;
  name: string;
  location: string;
  canonicalId?: string;
  lat?: number | null;
  lon?: number | null;
  facts?: PropertyFact[];
  distanceM?: number;
}

interface Props {
  property: PropertySummary;
  href?: string;
  actionLabel?: string;
  onActionClick?: () => void;
  expandable?: boolean;
}

export function PropertyCard({
  property,
  href,
  actionLabel,
  onActionClick,
  expandable = true,
}: Props) {
  const { getFieldLabel, t } = useLocale();
  const resolvedActionLabel = actionLabel ?? t("ui.auditAction");

  const facts = property.facts ?? [];
  const best = new Map<string, PropertyFact>();
  for (const f of facts) {
    const existing = best.get(f.fieldName);
    if (!existing || (TIER_RANK[f.tier] ?? 0) > (TIER_RANK[existing.tier] ?? 0)) {
      best.set(f.fieldName, f);
    }
  }
  const displayFacts = Array.from(best.values());

  const distanceLabel =
    property.distanceM != null
      ? property.distanceM < 1000
        ? `${Math.round(property.distanceM)} m`
        : `${(property.distanceM / 1000).toFixed(1)} km`
      : null;

  return (
    <div
      style={{
        background: "var(--wt-bg-elevated)",
        borderRadius: "var(--wt-radius-md)",
        border: "1px solid var(--wt-border)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {property.name}
          </p>
          <p style={{ fontSize: 12, color: "var(--wt-text-muted)", margin: "2px 0 0" }}>
            {property.location}
            {distanceLabel && (
              <span style={{ marginLeft: 8, color: "var(--wt-accent)" }}>{distanceLabel}</span>
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {displayFacts.slice(0, 3).map((fact) => (
            <TierBadge key={fact.fieldName} tier={fact.tier} label={getFieldLabel(fact.fieldName)} />
          ))}
        </div>

        {href ? (
          <a
            href={href}
            style={{
              fontSize: 12,
              color: "var(--wt-primary)",
              textDecoration: "none",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {resolvedActionLabel}
          </a>
        ) : onActionClick ? (
          <button
            type="button"
            onClick={onActionClick}
            style={{
              fontSize: 12,
              color: "var(--wt-primary)",
              background: "none",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {resolvedActionLabel}
          </button>
        ) : null}
      </div>

      {expandable && displayFacts.length > 3 && (
        <div
          style={{
            borderTop: "1px solid var(--wt-border)",
            padding: "10px 16px",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {displayFacts.slice(3).map((fact) => (
            <span
              key={fact.fieldName}
              style={{ fontSize: 11, color: "var(--wt-text-muted)" }}
            >
              {getFieldLabel(fact.fieldName)}: {fact.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
