export type AuditPhotoRef = {
  id?: string;
  url: string;
  caption?: string | null;
  fieldName?: string | null;
  scopeKey?: string | null;
};

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

/** Audit-step scope for property-level photos (not room-specific). */
export type AuditPhotoStepScope = "step:building_access" | "step:shared_facilities";

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

const SECTION_STEP_SCOPE: Record<string, AuditPhotoStepScope | null> = {
  entrance: "step:building_access",
  circulation: "step:building_access",
  parking: "step:building_access",
  notes: "step:building_access",
  bathroom: "step:shared_facilities",
  sensory: "step:shared_facilities",
  other: "step:shared_facilities",
  room: null,
};

export function stepScopeKey(step: "building_access" | "shared_facilities"): AuditPhotoStepScope {
  return step === "building_access" ? "step:building_access" : "step:shared_facilities";
}

export function isStepPhotoScope(scopeKey?: string | null): scopeKey is AuditPhotoStepScope {
  return scopeKey === "step:building_access" || scopeKey === "step:shared_facilities";
}

export function isRoomPhotoScope(scopeKey?: string | null): boolean {
  return Boolean(scopeKey?.startsWith("room-type:"));
}

export function factPhotoKey(fieldName: string, scopeKey?: string | null): string {
  return `${scopeKey ?? "property"}:${fieldName}`;
}

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
      const key = factPhotoKey(f.fieldName, f.scopeKey);
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
    const key = factPhotoKey(f.fieldName, f.scopeKey);
    return !assigned.has(key);
  });
  if (other.length > 0) {
    sections.push({ id: "other", labelKey: "ui.propertySectionOther", facts: other });
  }

  return sections;
}

function toDisplayPhoto(p: AuditPhotoRef): { url: string; caption: string | null; id?: string } {
  return { url: p.url, caption: p.caption ?? null, id: p.id };
}

export function photosForStepScope(
  photos: AuditPhotoRef[],
  scopeKey: AuditPhotoStepScope
): Array<{ url: string; caption: string | null; id?: string }> {
  return photos.filter((p) => (p.scopeKey ?? "") === scopeKey).map(toDisplayPhoto);
}

export function photosForRoomScope(
  photos: AuditPhotoRef[],
  scopeKey: string
): Array<{ url: string; caption: string | null; id?: string }> {
  if (!isRoomPhotoScope(scopeKey)) return [];
  return photos.filter((p) => (p.scopeKey ?? "") === scopeKey).map(toDisplayPhoto);
}

/**
 * Photos to show once under a property-detail section.
 * Callers should dedupe step scopes across sections.
 */
export function photosForSection(
  photos: AuditPhotoRef[],
  section: FactSection
): Array<{ url: string; caption: string | null; id?: string; groupKey?: string }> {
  if (section.id === "room") {
    const roomScopes = Array.from(
      new Set(
        section.facts
          .map((f) => f.scopeKey)
          .filter((s): s is string => Boolean(s && isRoomPhotoScope(s)))
      )
    );
    const out: Array<{ url: string; caption: string | null; id?: string; groupKey?: string }> = [];
    const seen = new Set<string>();
    for (const scope of roomScopes) {
      for (const p of photosForRoomScope(photos, scope)) {
        if (seen.has(p.url)) continue;
        seen.add(p.url);
        out.push({ ...p, groupKey: scope });
      }
    }
    return out;
  }

  const step = SECTION_STEP_SCOPE[section.id];
  if (!step) return [];
  return photosForStepScope(photos, step).map((p) => ({ ...p, groupKey: step }));
}

/** Explicit field-linked photos only (strict match). Step/room photos are not per-fact. */
export function photosForFact(
  photos: AuditPhotoRef[],
  fact: DisplayFact
): Array<{ url: string; caption: string | null; id?: string }> {
  const scope = fact.scopeKey ?? "property";
  return photos
    .filter(
      (p) =>
        Boolean(p.fieldName) &&
        p.fieldName === fact.fieldName &&
        (p.scopeKey ?? "property") === scope
    )
    .map(toDisplayPhoto);
}

/**
 * Photos with no step/room scope — shown once in a general pool.
 * Step and room photos are NOT treated as unlinked.
 */
export function unassignedPhotos(
  photos: AuditPhotoRef[],
  _facts?: DisplayFact[]
): Array<{ url: string; caption: string | null; id?: string }> {
  return photos
    .filter((p) => {
      if (isStepPhotoScope(p.scopeKey)) return false;
      if (isRoomPhotoScope(p.scopeKey)) return false;
      if (p.fieldName) return false;
      return true;
    })
    .map(toDisplayPhoto);
}

export type PhotoStepGroup = {
  key: string;
  scopeKey: string;
  photos: AuditPhotoRef[];
};

/** Group photos by step / room / general for display. */
export function groupPhotosByStepScope(photos: AuditPhotoRef[]): PhotoStepGroup[] {
  const groups = new Map<string, PhotoStepGroup>();

  function push(key: string, scopeKey: string, photo: AuditPhotoRef) {
    const existing = groups.get(key);
    if (existing) existing.photos.push(photo);
    else groups.set(key, { key, scopeKey, photos: [photo] });
  }

  for (const photo of photos) {
    if (isStepPhotoScope(photo.scopeKey)) {
      push(photo.scopeKey, photo.scopeKey, photo);
    } else if (isRoomPhotoScope(photo.scopeKey)) {
      push(photo.scopeKey!, photo.scopeKey!, photo);
    } else {
      push("general", "general", photo);
    }
  }

  const order = (key: string) => {
    if (key === "step:building_access") return 0;
    if (key === "step:shared_facilities") return 1;
    if (key.startsWith("room-type:")) return 2;
    return 3;
  };

  return Array.from(groups.values()).sort((a, b) => {
    const d = order(a.key) - order(b.key);
    if (d !== 0) return d;
    return a.key.localeCompare(b.key);
  });
}
