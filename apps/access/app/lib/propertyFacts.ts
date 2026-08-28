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
export type AuditPhotoStepScope =
  | "step:entrance"
  | "step:mobility"
  | "step:bathroom"
  | "step:communication"
  | "step:building_access"
  | "step:shared_facilities";

const SECTION_RULES: Array<{ id: string; labelKey: string; fields: string[]; prefixes?: string[] }> = [
  {
    id: "entrance",
    labelKey: "ui.propertySectionEntrance",
    fields: [
      "step_free_entrance",
      "automatic_door",
      "ramp_present",
      "door_width_cm",
      "path_to_entrance",
    ],
  },
  {
    id: "mobility",
    labelKey: "ui.propertySectionCirculation",
    fields: [
      "elevator_present",
      "elevator_width_cm",
      "corridor_min_width_cm",
      "parking_accessible",
      "pool_lift",
      "elevator_floor_count",
    ],
  },
  {
    id: "room",
    labelKey: "ui.propertySectionRoom",
    fields: [
      "room_types_available",
      "accessible_room_description",
      "step_free_room",
      "clear_space_beside_bed",
      "bed_height_cm",
      "turning_circle_cm",
      "accessible_room_count",
    ],
    prefixes: ["room-type:"],
  },
  {
    id: "bathroom",
    labelKey: "ui.propertySectionBathroom",
    fields: ["accessible_bathroom", "roll_in_shower", "grab_bars_bathroom"],
  },
  {
    id: "communication",
    labelKey: "ui.propertySectionSensory",
    fields: [
      "hearing_loop",
      "braille_signage",
      "tactile_paving",
      "visual_alarms",
      "service_animal_policy",
    ],
  },
  {
    id: "notes",
    labelKey: "ui.propertySectionNotes",
    fields: ["notes", "quiet_hours_start", "quiet_hours_end"],
  },
];

const SECTION_STEP_SCOPE: Record<string, AuditPhotoStepScope | null> = {
  entrance: "step:entrance",
  mobility: "step:mobility",
  bathroom: "step:bathroom",
  communication: "step:communication",
  notes: "step:communication",
  other: "step:communication",
  room: null,
};

const PHOTO_STEP_SCOPES = new Set<string>([
  "step:entrance",
  "step:mobility",
  "step:bathroom",
  "step:communication",
  "step:building_access",
  "step:shared_facilities",
]);

export function stepScopeKey(
  step: "entrance" | "mobility" | "bathroom" | "communication" | "building_access" | "shared_facilities"
): AuditPhotoStepScope {
  if (step === "building_access") return "step:building_access";
  if (step === "shared_facilities") return "step:shared_facilities";
  return `step:${step}` as AuditPhotoStepScope;
}

export function isStepPhotoScope(scopeKey?: string | null): scopeKey is AuditPhotoStepScope {
  return Boolean(scopeKey && PHOTO_STEP_SCOPES.has(scopeKey));
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

const ROOM_FACT_ORDER = [
  "step_free_room",
  "clear_space_beside_bed",
  "bed_height_cm",
  "turning_circle_cm",
  "accessible_room_description",
  "roll_in_shower",
  "grab_bars_bathroom",
];

function sortRoomFacts(facts: DisplayFact[]): DisplayFact[] {
  return [...facts].sort((a, b) => {
    const ai = ROOM_FACT_ORDER.indexOf(a.fieldName);
    const bi = ROOM_FACT_ORDER.indexOf(b.fieldName);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export type RoomTypeFactGroup = {
  typeId: string;
  facts: DisplayFact[];
};

/** Split the Rooms section into property-level overview vs per-room-type groups. */
export function splitRoomSectionFacts(facts: DisplayFact[]): {
  overview: DisplayFact[];
  groups: RoomTypeFactGroup[];
} {
  const overview: DisplayFact[] = [];
  const byType = new Map<string, DisplayFact[]>();

  for (const fact of facts) {
    const scope = fact.scopeKey ?? "property";
    if (isRoomPhotoScope(scope)) {
      const typeId = scope.slice("room-type:".length);
      const list = byType.get(typeId) ?? [];
      list.push(fact);
      byType.set(typeId, list);
    } else {
      overview.push(fact);
    }
  }

  const orderFact = overview.find((f) => f.fieldName === "room_types_available");
  const preferred = (orderFact?.value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const groups: RoomTypeFactGroup[] = [];
  const seen = new Set<string>();
  for (const typeId of preferred) {
    const grouped = byType.get(typeId);
    if (!grouped) continue;
    groups.push({ typeId, facts: sortRoomFacts(grouped) });
    seen.add(typeId);
  }
  for (const [typeId, grouped] of byType) {
    if (seen.has(typeId)) continue;
    groups.push({ typeId, facts: sortRoomFacts(grouped) });
  }

  return { overview, groups };
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

/** Live property photos to show read-only on an audit wizard step. */
export function existingPhotosForAuditStep(
  photos: AuditPhotoRef[],
  step: "entrance" | "mobility" | "bathroom" | "communication"
): Array<{ url: string; caption: string | null; id?: string }> {
  const primary = stepScopeKey(step);
  const legacy: AuditPhotoStepScope | null =
    step === "entrance"
      ? "step:building_access"
      : step === "bathroom"
        ? "step:shared_facilities"
        : null;
  const seen = new Set<string>();
  const out: Array<{ url: string; caption: string | null; id?: string }> = [];
  for (const p of photos) {
    const scope = p.scopeKey ?? "";
    if (scope !== primary && scope !== legacy) continue;
    if (seen.has(p.url)) continue;
    seen.add(p.url);
    out.push(toDisplayPhoto(p));
  }
  return out;
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
  const modern = photosForStepScope(photos, step).map((p) => ({ ...p, groupKey: step }));
  // Also surface legacy building_access / shared_facilities photos under matching sections.
  if (section.id === "entrance" || section.id === "mobility") {
    const legacy = photosForStepScope(photos, "step:building_access").map((p) => ({
      ...p,
      groupKey: "step:building_access" as const,
    }));
    return [...modern, ...legacy];
  }
  if (section.id === "bathroom" || section.id === "communication") {
    const legacy = photosForStepScope(photos, "step:shared_facilities").map((p) => ({
      ...p,
      groupKey: "step:shared_facilities" as const,
    }));
    return [...modern, ...legacy];
  }
  return modern;
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
    if (key === "step:entrance" || key === "step:building_access") return 0;
    if (key === "step:mobility") return 1;
    if (key.startsWith("room-type:")) return 2;
    if (key === "step:bathroom" || key === "step:shared_facilities") return 3;
    if (key === "step:communication") return 4;
    return 5;
  };

  return Array.from(groups.values()).sort((a, b) => {
    const d = order(a.key) - order(b.key);
    if (d !== 0) return d;
    return a.key.localeCompare(b.key);
  });
}
