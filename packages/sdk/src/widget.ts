import { WikiTraveler } from "./client";
import type { AccessibilityResponse } from "./client";
import { TIER_COLOR, TIER_LABEL, Tier } from "@wikitraveler/core";

export interface WidgetOptions {
  /** CSS selector OR HTMLElement to mount the widget into. */
  target: string | HTMLElement;
  /** Amadeus property ID to display. */
  propertyId: string;
  /** WikiTraveler node URL. */
  nodeUrl: string;
}

const FIELD_LABELS: Record<string, string> = {
  door_width_cm: "Door Width",
  ramp_present: "Ramp Present",
  elevator_present: "Elevator",
  elevator_floor_count: "Elevator Floors",
  quiet_hours_start: "Quiet Hours Start",
  quiet_hours_end: "Quiet Hours End",
  accessible_bathroom: "Accessible Bathroom",
  hearing_loop: "Hearing Loop",
  braille_signage: "Braille Signage",
  step_free_entrance: "Step-Free Entrance",
  parking_accessible: "Accessible Parking",
  notes: "Notes",
};

function badge(tier: Tier): string {
  const color = TIER_COLOR[tier] ?? "#9ca3af";
  const label = TIER_LABEL[tier] ?? tier;
  return `<span style="
    display:inline-block;
    padding:2px 8px;
    border-radius:999px;
    font-size:11px;
    font-weight:600;
    color:#fff;
    background:${color};
    margin-left:8px;
    vertical-align:middle;
    font-family:var(--wt-font-family,sans-serif);
  ">${label}</span>`;
}

function renderFacts(data: AccessibilityResponse): string {
  if (data.facts.length === 0) {
    return `<p style="color:#9ca3af;font-style:italic;font-family:var(--wt-font-family,sans-serif)">No accessibility data available for this property yet.</p>`;
  }
  const rows = data.facts
    .map(
      (f) => `
    <tr>
      <td style="padding:6px 8px;font-weight:500;color:#374151;font-family:var(--wt-font-family,sans-serif)">${FIELD_LABELS[f.fieldName] ?? f.fieldName}</td>
      <td style="padding:6px 8px;color:#1f2937;font-family:var(--wt-font-family,sans-serif)">${f.value}</td>
      <td style="padding:6px 8px">${badge(f.tier)}</td>
    </tr>`
    )
    .join("");
  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead>
        <tr style="border-bottom:1px solid #e5e7eb">
          <th style="padding:6px 8px;text-align:left;color:#6b7280;font-size:12px;font-family:var(--wt-font-family,sans-serif)">Feature</th>
          <th style="padding:6px 8px;text-align:left;color:#6b7280;font-size:12px;font-family:var(--wt-font-family,sans-serif)">Value</th>
          <th style="padding:6px 8px;text-align:left;color:#6b7280;font-size:12px;font-family:var(--wt-font-family,sans-serif)">Trust</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin-top:8px;font-family:var(--wt-font-family,sans-serif)">
      Powered by <a href="https://github.com/wikitraveler" style="color:#60a5fa;text-decoration:none">WikiTraveler</a>
    </p>`;
}

/**
 * Mount a pre-styled accessibility widget into a DOM element.
 *
 * Usage (CDN):
 * ```html
 * <div id="wt-widget"
 *      data-property-id="AMADEUS_PROP_ID"
 *      data-node-url="https://my-node.example.com"></div>
 * <script>WikiTraveler.mountWidget('#wt-widget');</script>
 * ```
 *
 * Usage (programmatic):
 * ```js
 * import { mountWidget } from '@wikitraveler/sdk';
 * mountWidget({ target: '#wt-widget', propertyId: 'PROP_123', nodeUrl: 'https://...' });
 * ```
 */
export async function mountWidget(
  optionsOrSelector: WidgetOptions | string | HTMLElement
): Promise<void> {
  let el: HTMLElement | null = null;
  let propertyId: string;
  let nodeUrl: string;

  if (typeof optionsOrSelector === "string") {
    el = document.querySelector<HTMLElement>(optionsOrSelector);
  } else if (optionsOrSelector instanceof HTMLElement) {
    el = optionsOrSelector;
  } else {
    el =
      typeof optionsOrSelector.target === "string"
        ? document.querySelector<HTMLElement>(optionsOrSelector.target)
        : optionsOrSelector.target;
    propertyId = optionsOrSelector.propertyId;
    nodeUrl = optionsOrSelector.nodeUrl;
  }

  if (!el) {
    console.warn("WikiTraveler.mountWidget: target element not found");
    return;
  }

  // If called with only a selector/element, read from data attributes
  propertyId ??= el.dataset.propertyId ?? "";
  nodeUrl ??= el.dataset.nodeUrl ?? "";

  if (!propertyId || !nodeUrl) {
    el.innerHTML = `<p style="color:#f87171">WikiTraveler: missing data-property-id or data-node-url</p>`;
    return;
  }

  el.innerHTML = `<p style="color:#9ca3af;font-family:sans-serif">Loading accessibility data…</p>`;

  try {
    const client = new WikiTraveler({ nodeUrl });
    const data = await client.getAccessibility(propertyId);
    el.innerHTML = renderFacts(data);
  } catch (err) {
    el.innerHTML = `<p style="color:#f87171;font-family:sans-serif">Could not load accessibility data. Is the node reachable?</p>`;
    console.error("WikiTraveler widget error:", err);
  }
}

/** Auto-mount all [data-wt-widget] elements on DOMContentLoaded. */
export function autoMount(): void {
  const init = () => {
    document.querySelectorAll<HTMLElement>("[data-wt-widget]").forEach((el) => {
      mountWidget(el);
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
