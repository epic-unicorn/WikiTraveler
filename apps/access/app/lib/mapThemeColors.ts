export type MapPinColors = {
  stroke: string;
  fill: string;
};

const FALLBACK: MapPinColors = {
  stroke: "#1d4ed8",
  fill: "#60a5fa",
};

function readCssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** Leaflet markers need resolved colors — read from theme tokens on :root. */
export function readMapPinColors(): MapPinColors {
  if (typeof document === "undefined") return FALLBACK;
  const stroke = readCssVar("--wt-map-pin-stroke", readCssVar("--wt-primary", FALLBACK.stroke));
  const fill = readCssVar("--wt-map-pin-fill", stroke);
  return { stroke, fill };
}

export function readMapUserColors(): MapPinColors {
  if (typeof document === "undefined") {
    return {
      stroke: "#0891b2",
      fill: "#0891b2",
    };
  }
  const stroke = readCssVar("--wt-map-user-stroke", readCssVar("--wt-accent", "#0891b2"));
  const fill = readCssVar("--wt-map-user-fill", stroke);
  return { stroke, fill };
}
