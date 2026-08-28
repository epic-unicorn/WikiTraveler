export type SavedPlaceCategory = "stay" | "hotel" | "other";

const OTHER_RE =
  /\b(restaurant|café|cafe|museum|bar|bistro|brasserie|eetcafe|eetcafé|gallery|galerie)\b/i;
const HOTEL_RE = /\b(hotel|motel|\binn\b|holiday inn)\b/i;

/** Best-effort category from name/location until OSM type is on the Access payload. */
export function inferSavedCategory(name: string, location = ""): SavedPlaceCategory {
  const text = `${name} ${location}`;
  if (OTHER_RE.test(text)) return "other";
  if (HOTEL_RE.test(text)) return "hotel";
  return "stay";
}
