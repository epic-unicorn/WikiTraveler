export type TaggedNoteSection = {
  /** Null = text before the first `[Category]` tag. */
  heading: string | null;
  items: string[];
};

const TAG_RE = /\[([^\]]{1,48})\]/g;
const HEADING_RE = /^[A-ZÀ-Ÿ][A-Za-zÀ-ÿ]*(?:[ /-][A-ZÀ-Ÿ][A-Za-zÀ-ÿ]*)?$/;
const EMPTY_ITEM_RE =
  /^(none of these( info)? found\.?|no (additional )?info(rmation)? found\.?|geen (extra )?(info|informatie).*\.?|n\/a|none|-)$/i;

function isCategoryHeading(raw: string): boolean {
  return HEADING_RE.test(raw.trim());
}

function splitItems(body: string): string[] {
  const trimmed = body.trim();
  if (!trimmed) return [];
  if (/[\n•]/.test(trimmed)) {
    return trimmed
      .split(/\n+|•/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return trimmed
    .split(/(?<=\S) (?=[A-ZÀ-Ÿ][a-zà-ÿ])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function keepItem(item: string): boolean {
  return !EMPTY_ITEM_RE.test(item.trim());
}

/**
 * Wheelmap / OSM extras often land in `notes` as `[Bathroom] Foo Bar [Communication] None…`.
 * Returns structured sections, or null when the text is a normal note.
 */
export function parseTaggedNotes(raw: string): TaggedNoteSection[] | null {
  const text = raw.trim();
  if (!text) return null;

  const matches = [...text.matchAll(TAG_RE)].filter((m) => isCategoryHeading(m[1] ?? ""));
  if (matches.length === 0) return null;
  const hasKnown = matches.some((m) => taggedNoteHeadingKey(m[1] ?? ""));
  if (!hasKnown && matches.length < 2) return null;

  const sections: TaggedNoteSection[] = [];
  const firstIndex = matches[0].index ?? 0;
  if (firstIndex > 0) {
    const preamble = splitItems(text.slice(0, firstIndex)).filter(keepItem);
    if (preamble.length > 0) sections.push({ heading: null, items: preamble });
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const heading = (match[1] ?? "").trim();
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const items = splitItems(text.slice(start, end)).filter(keepItem);
    if (items.length === 0) continue;
    sections.push({ heading, items });
  }

  return sections.length > 0 ? sections : null;
}

const HEADING_I18N: Record<string, string> = {
  bathroom: "ui.propertySectionBathroom",
  badkamer: "ui.propertySectionBathroom",
  badezimmer: "ui.propertySectionBathroom",
  communication: "ui.auditStepCommunication",
  communicatie: "ui.auditStepCommunication",
  kommunikation: "ui.auditStepCommunication",
  entrance: "ui.propertySectionEntrance",
  ingang: "ui.propertySectionEntrance",
  eingang: "ui.propertySectionEntrance",
  parking: "ui.propertySectionParking",
  parkeren: "ui.propertySectionParking",
  parken: "ui.propertySectionParking",
  rooms: "ui.propertySectionRoom",
  room: "ui.propertySectionRoom",
  kamers: "ui.propertySectionRoom",
  zimmer: "ui.propertySectionRoom",
  elevator: "ui.a11yPref_elevator_present",
  lift: "ui.a11yPref_elevator_present",
  aufzug: "ui.a11yPref_elevator_present",
  mobility: "ui.auditStepMobility",
  mobiliteit: "ui.auditStepMobility",
};

export function taggedNoteHeadingKey(heading: string): string | null {
  return HEADING_I18N[heading.trim().toLowerCase()] ?? null;
}
