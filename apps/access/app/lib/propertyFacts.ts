const SECTION_RULES: Array<{ id: string; labelKey: string; fields: string[]; prefixes?: string[] }> = [
  {
    id: "entrance",
    labelKey: "ui.propertySectionEntrance",
    fields: ["step_free_entrance", "ramp_present", "door_width_cm", "tactile_paving"],
  },
  {
    id: "circulation",
    labelKey: "ui.propertySectionCirculation",
    fields: ["elevator_present", "elevator_floor_count", "turning_circle_cm"],
  },
  {
    id: "room",
    labelKey: "ui.propertySectionRoom",
    fields: [
      "accessible_room_count",
      "accessible_room_description",
      "room_types_available",
      "bed_height_cm",
      "roll_in_shower",
    ],
    prefixes: ["room-type:"],
  },
  {
    id: "bathroom",
    labelKey: "ui.propertySectionBathroom",
    fields: ["accessible_bathroom", "grab_bars_bathroom"],
  },
  {
    id: "parking",
    labelKey: "ui.propertySectionParking",
    fields: ["parking_accessible", "pool_lift"],
  },
  {
    id: "sensory",
    labelKey: "ui.propertySectionSensory",
    fields: ["hearing_loop", "braille_signage", "service_animal_policy"],
  },
  {
    id: "notes",
    labelKey: "ui.propertySectionNotes",
    fields: ["notes", "quiet_hours_start", "quiet_hours_end"],
  },
];

export type DisplayFact = {
  fieldName: string;
  scopeKey?: string;
  value: string;
  displayValue?: string;
  tier: string;
  timestamp?: string;
  valueLocale?: string | null;
  machineTranslated?: boolean;
  signatureHash?: string | null;
};

export type FactSection = {
  id: string;
  labelKey: string;
  facts: DisplayFact[];
};

function matchesSection(fact: DisplayFact, section: (typeof SECTION_RULES)[0]): boolean {
  if (section.fields.includes(fact.fieldName)) return true;
  if (section.prefixes?.some((p) => fact.scopeKey?.startsWith(p))) return true;
  return false;
}

export function groupFactsBySection(facts: DisplayFact[]): FactSection[] {
  const assigned = new Set<string>();
  const sections: FactSection[] = [];

  for (const rule of SECTION_RULES) {
    const sectionFacts = facts.filter((f) => {
      const key = `${f.scopeKey ?? "property"}-${f.fieldName}`;
      if (assigned.has(key)) return false;
      if (!matchesSection(f, rule)) return false;
      assigned.add(key);
      return true;
    });
    if (sectionFacts.length > 0) {
      sections.push({ id: rule.id, labelKey: rule.labelKey, facts: sectionFacts });
    }
  }

  const other = facts.filter((f) => {
    const key = `${f.scopeKey ?? "property"}-${f.fieldName}`;
    return !assigned.has(key);
  });
  if (other.length > 0) {
    sections.push({ id: "other", labelKey: "ui.propertySectionOther", facts: other });
  }

  return sections;
}

export function photosForFact(
  photos: Array<{ url: string; fieldName: string | null; scopeKey: string | null; caption: string | null }>,
  fact: DisplayFact
): Array<{ url: string; caption: string | null }> {
  return photos
    .filter(
      (p) =>
        (p.fieldName && p.fieldName === fact.fieldName) ||
        (p.scopeKey && fact.scopeKey && p.scopeKey === fact.scopeKey)
    )
    .map((p) => ({ url: p.url, caption: p.caption }));
}

export function unassignedPhotos(
  photos: Array<{ url: string; fieldName: string | null; scopeKey: string | null; caption: string | null }>,
  facts: DisplayFact[]
): Array<{ url: string; caption: string | null }> {
  return photos
    .filter((p) => {
      if (!p.fieldName && !p.scopeKey) return true;
      return !facts.some(
        (f) =>
          (p.fieldName && p.fieldName === f.fieldName) ||
          (p.scopeKey && f.scopeKey && p.scopeKey === f.scopeKey)
      );
    })
    .map((p) => ({ url: p.url, caption: p.caption }));
}
