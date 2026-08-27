export type AuditStepId =
  | "entrance"
  | "mobility"
  | "room"
  | "bathroom"
  | "communication"
  | "review";

/** Fixed WikiTraveler Access wizard — full audit only. */
export const AUDIT_WIZARD_STEPS: AuditStepId[] = [
  "entrance",
  "mobility",
  "room",
  "bathroom",
  "communication",
  "review",
];

export const FIELD_AUDIT_STEP: Record<string, AuditStepId> = {
  step_free_entrance: "entrance",
  automatic_door: "entrance",
  ramp_present: "entrance",
  door_width_cm: "entrance",
  path_to_entrance: "entrance",

  elevator_present: "mobility",
  elevator_width_cm: "mobility",
  corridor_min_width_cm: "mobility",
  parking_accessible: "mobility",
  pool_lift: "mobility",

  room_types_available: "room",
  accessible_room_description: "room",
  step_free_room: "room",
  clear_space_beside_bed: "room",
  bed_height_cm: "room",
  turning_circle_cm: "room",

  accessible_bathroom: "bathroom",
  roll_in_shower: "bathroom",
  grab_bars_bathroom: "bathroom",

  hearing_loop: "communication",
  braille_signage: "communication",
  tactile_paving: "communication",
  visual_alarms: "communication",
  service_animal_policy: "communication",

  quiet_hours_start: "review",
  quiet_hours_end: "review",
  notes: "review",
};

export function auditStepForField(fieldName: string): AuditStepId | undefined {
  return FIELD_AUDIT_STEP[fieldName];
}

export function fieldsForStep(step: AuditStepId): string[] {
  return Object.entries(FIELD_AUDIT_STEP)
    .filter(([, s]) => s === step)
    .map(([name]) => name);
}
