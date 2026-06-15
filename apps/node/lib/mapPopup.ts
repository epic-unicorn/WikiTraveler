export interface MapPin {
  id: string;
  name: string;
  location: string;
  lat: number;
  lon: number;
  audited?: boolean;
  facts?: Record<string, { value: string; tier: string }>;
}

export const FACT_LABELS: Record<string, string> = {
  step_free_entrance: "Step-free entrance",
  accessible_bathroom: "Accessible bathroom",
  elevator_present: "Elevator",
  ramp_present: "Ramp",
  parking_accessible: "Accessible parking",
};

export function formatFactStatus(value: string): string {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return value || "Unknown";
}

export function buildPopup(pin: MapPin): string {
  const facts = pin.facts ?? {};
  const factRows = Object.keys(FACT_LABELS)
    .map((key) => {
      const fact = facts[key];
      if (!fact) return "";
      const status = formatFactStatus(fact.value);
      return `<div class="wt-popup-fact"><span class="wt-popup-fact-label">${FACT_LABELS[key]}:</span> <span class="wt-popup-fact-value">${status}</span></div>`;
    })
    .filter(Boolean)
    .join("");

  return `
    <div class="wt-popup">
      <p class="wt-popup-title">${pin.name}</p>
      <p class="wt-popup-loc">${pin.location}</p>
      ${factRows ? `<div class="wt-popup-facts">${factRows}</div>` : ""}
      <a href="/properties/${pin.id}" class="wt-popup-cta">View or audit property</a>
    </div>
  `;
}
