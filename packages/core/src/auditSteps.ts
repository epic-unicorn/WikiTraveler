export type AuditStepId =
  | "building_access"
  | "shared_facilities"
  | "rooms"
  | "review";

/** Fixed Field Kit wizard — full audit only. */
export const AUDIT_WIZARD_STEPS: AuditStepId[] = [
  "building_access",
  "shared_facilities",
  "rooms",
  "review",
];

export const FIELD_AUDIT_STEP: Record<string, AuditStepId> = {
  parking_accessible: "building_access",
  step_free_entrance: "building_access",
  ramp_present: "building_access",
  door_width_cm: "building_access",
  elevator_present: "building_access",
  elevator_floor_count: "building_access",
  tactile_paving: "building_access",
  braille_signage: "building_access",
  hearing_loop: "building_access",
  notes: "building_access",
  service_animal_policy: "building_access",
  accessible_bathroom: "shared_facilities",
  pool_lift: "shared_facilities",
  quiet_hours_start: "shared_facilities",
  quiet_hours_end: "shared_facilities",
  accessible_room_count: "rooms",
  room_types_available: "rooms",
  accessible_room_description: "rooms",
  roll_in_shower: "rooms",
  grab_bars_bathroom: "rooms",
  bed_height_cm: "rooms",
  turning_circle_cm: "rooms",
};

export function auditStepForField(fieldName: string): AuditStepId | undefined {
  return FIELD_AUDIT_STEP[fieldName];
}

export function fieldsForStep(step: AuditStepId): string[] {
  return Object.entries(FIELD_AUDIT_STEP)
    .filter(([, s]) => s === step)
    .map(([name]) => name);
}
