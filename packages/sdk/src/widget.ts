import { WikiTraveler } from "./client";
import type { AccessibilityResponse } from "./client";
import { TIER_LABEL, Tier } from "@wikitraveler/core";

export interface WidgetOptions {
  /** CSS selector OR HTMLElement to mount the widget into. */
  target: string | HTMLElement;
  /** Amadeus property ID to display. */
  propertyId: string;
  /** WikiTraveler node URL. */
  nodeUrl: string;
  /** JWT obtained from POST /api/auth/login. Required for authenticated nodes. */
  token?: string;
}

const WIDGET_STYLE_ID = "wt-widget-styles";

/** Injected once for CDN embeds that do not link wikitraveler-ui.css. */
const WIDGET_CSS = `
.wt-widget{font-family:var(--wt-font,sans-serif);color:var(--wt-text,#0f172a);font-size:13px;line-height:1.45;min-width:0}
.wt-widget-facts{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;max-height:min(480px,60vh);overflow-y:auto;overscroll-behavior:contain}
.wt-widget-fact{display:flex;flex-direction:column;gap:4px;padding:10px 12px;background:var(--wt-bg-secondary,#f1f5f9);border:1px solid var(--wt-border,#e2e8f0);border-radius:var(--wt-radius-sm,8px)}
.wt-widget-fact-label{font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:var(--wt-text-muted,#64748b)}
.wt-widget-fact-body{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:6px 10px}
.wt-widget-fact-value{color:var(--wt-text,#0f172a);word-break:break-word;flex:1 1 120px;min-width:0}
.wt-widget-fact .wt-tier-badge{display:inline-block;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:600;flex-shrink:0;white-space:nowrap}
.wt-tier-official{background:var(--wt-tier-official-bg,#e2e8f0);color:var(--wt-tier-official-text,#475569)}
.wt-tier-ai_guess{background:var(--wt-tier-ai-bg,#fef3c7);color:var(--wt-tier-ai-text,#92400e)}
.wt-tier-verified{background:var(--wt-tier-verified-bg,#d1fae5);color:var(--wt-tier-verified-text,#065f46)}
.wt-tier-confirmed{background:var(--wt-tier-confirmed-bg,#dbeafe);color:var(--wt-tier-confirmed-text,#1e40af)}
.wt-widget-empty{color:var(--wt-text-muted,#64748b);font-style:italic;margin:0}
.wt-widget-attribution{font-size:11px;color:var(--wt-text-muted,#64748b);margin:10px 0 0}
.wt-widget-attribution a{color:var(--wt-primary,#1d4ed8);text-decoration:none}
.wt-widget-loading,.wt-widget-error{margin:0;font-size:13px}
.wt-widget-error{color:var(--wt-danger,#dc2626)}
`;

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

const TIER_CLASS: Record<Tier, string> = {
  OFFICIAL: "wt-tier-official",
  AI_GUESS: "wt-tier-ai_guess",
  VERIFIED: "wt-tier-verified",
  CONFIRMED: "wt-tier-confirmed",
};

function ensureWidgetStyles(): void {
  if (typeof document === "undefined" || document.getElementById(WIDGET_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = WIDGET_STYLE_ID;
  style.textContent = WIDGET_CSS;
  document.head.appendChild(style);
}

function badge(tier: Tier): string {
  const label = TIER_LABEL[tier] ?? tier;
  const cls = TIER_CLASS[tier] ?? "";
  return `<span class="wt-tier-badge ${cls}" aria-label="Trust tier: ${label}">${label}</span>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderFacts(data: AccessibilityResponse): string {
  if (data.facts.length === 0) {
    return `<div class="wt-widget" role="region" aria-label="WikiTraveler accessibility data"><p class="wt-widget-empty">No accessibility data available for this property yet.</p></div>`;
  }

  const items = data.facts
    .map((f) => {
      const label = FIELD_LABELS[f.fieldName] ?? f.fieldName;
      const value = escapeHtml(String(f.value));
      return `<li class="wt-widget-fact">
        <span class="wt-widget-fact-label">${escapeHtml(label)}</span>
        <span class="wt-widget-fact-body">
          <span class="wt-widget-fact-value">${value}</span>
          ${badge(f.tier)}
        </span>
      </li>`;
    })
    .join("");

  return `
    <div class="wt-widget" role="region" aria-label="WikiTraveler accessibility data">
      <ul class="wt-widget-facts">${items}</ul>
      <p class="wt-widget-attribution">
        Powered by <a href="https://github.com/wikitraveler">WikiTraveler</a>
      </p>
    </div>`;
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
  ensureWidgetStyles();

  let el: HTMLElement | null = null;
  let propertyId: string;
  let nodeUrl: string;
  let token: string | undefined;

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
    token = optionsOrSelector.token;
  }

  if (!el) {
    console.warn("WikiTraveler.mountWidget: target element not found");
    return;
  }

  // If called with only a selector/element, read from data attributes
  propertyId ??= el.dataset.propertyId ?? "";
  nodeUrl ??= el.dataset.nodeUrl ?? "";
  token ??= el.dataset.token;

  if (!propertyId || !nodeUrl) {
    el.setAttribute("role", "alert");
    el.innerHTML = `<p class="wt-widget-error">WikiTraveler: missing data-property-id or data-node-url</p>`;
    return;
  }

  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-busy", "true");
  el.innerHTML = `<p class="wt-widget-loading wt-text-muted">Loading accessibility data…</p>`;

  try {
    const client = new WikiTraveler({ nodeUrl, token });
    const data = await client.getAccessibility(propertyId);
    el.removeAttribute("aria-busy");
    el.removeAttribute("role");
    el.removeAttribute("aria-live");
    el.innerHTML = renderFacts(data);
  } catch (err) {
    el.removeAttribute("aria-busy");
    el.setAttribute("role", "alert");
    el.innerHTML = `<p class="wt-widget-error">Could not load accessibility data. Is the node reachable?</p>`;
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
