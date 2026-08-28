import { propertyHref } from "./propertyHref";
import { auditHref } from "./auditHref";
import type { MapPin } from "./accessApi";

const TIER_RANK: Record<string, number> = {
  OFFICIAL: 0,
  AI_GUESS: 1,
  VERIFIED: 2,
  CONFIRMED: 3,
};

const FACT_LABELS: Record<string, string> = {
  step_free_entrance: "Step-free entrance",
  accessible_bathroom: "Accessible bathroom",
  elevator_present: "Elevator",
  ramp_present: "Ramp",
  parking_accessible: "Accessible parking",
  door_width_cm: "Door width (cm)",
  hearing_loop: "Hearing loop",
  braille_signage: "Braille signage",
  notes: "Notes",
};

function formatFactStatus(value: string): string {
  if (value === "yes" || value === "true") return "Yes";
  if (value === "no" || value === "false") return "No";
  if (value === "partial") return "Partial";
  if (value === "n/a" || value === "n.a." || value === "na") return "N/A";
  return value || "Unknown";
}

function labelForField(fieldName: string): string {
  return (
    FACT_LABELS[fieldName] ??
    fieldName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function tierLabel(tier: string): string | null {
  if (tier === "VERIFIED") return "Verified";
  if (tier === "CONFIRMED") return "Confirmed";
  if (tier === "AI_GUESS") return "AI estimate";
  return null;
}

interface PopupLabels {
  view: string;
  audit: string;
  auditedOpen: string;
}

export function buildAccessMapTooltip(pin: MapPin): string {
  return `
    <div class="wt-map-tooltip">
      <p class="wt-map-tooltip-title">${pin.name}</p>
      <p class="wt-map-tooltip-loc">${pin.location}</p>
    </div>
  `;
}

export function buildAccessMapPopup(
  pin: MapPin,
  homeNodeUrl: string,
  propertyNodeUrl: string,
  labels: PopupLabels,
  asContributor: boolean
): string {
  const facts = pin.facts ?? {};
  const sorted = Object.entries(facts).sort(([aKey, aFact], [bKey, bFact]) => {
    const tierDiff = (TIER_RANK[bFact.tier] ?? 0) - (TIER_RANK[aFact.tier] ?? 0);
    if (tierDiff !== 0) return tierDiff;
    return labelForField(aKey).localeCompare(labelForField(bKey));
  });

  const factRows = sorted
    .map(([key, fact]) => {
      const status = formatFactStatus(fact.value);
      const badge = tierLabel(fact.tier);
      const badgeHtml = badge
        ? `<span class="wt-popup-tier wt-popup-tier--${fact.tier.toLowerCase()}">${badge}</span>`
        : "";
      return `<div class="wt-popup-fact"><span class="wt-popup-fact-label">${labelForField(key)}:</span> <span class="wt-popup-fact-value">${status}</span>${badgeHtml}</div>`;
    })
    .join("");

  const viewUrl = propertyHref(pin.id, propertyNodeUrl, homeNodeUrl);
  const auditUrl = auditHref(pin.id, propertyNodeUrl, homeNodeUrl);

  const actions = asContributor
    ? `<div class="wt-popup-actions">
        <a href="${viewUrl}" class="wt-popup-cta wt-popup-cta--secondary">${labels.view}</a>
        <a href="${auditUrl}" class="wt-popup-cta">${labels.audit}</a>
      </div>`
    : `<a href="${viewUrl}" class="wt-popup-cta">${labels.view}</a>`;

  return `
    <div class="wt-popup">
      <p class="wt-popup-title">${pin.name}</p>
      <p class="wt-popup-loc">${pin.location}</p>
      ${factRows ? `<div class="wt-popup-facts">${factRows}</div>` : pin.audited ? `<p class="wt-popup-audited">${labels.auditedOpen}</p>` : ""}
      ${actions}
    </div>
  `;
}
