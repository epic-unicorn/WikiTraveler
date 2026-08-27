# Access UX redesign (IA + audit catalogue)

Product lock for the Access PWA redesign on branch `access-ui-redesign`. Implementation follows milestones M0–M5 in the redesign plan.

## Information architecture

**Bottom nav (shared for all roles):** Search | Saved | Profile

| Former tab | New home |
|------------|----------|
| Near me | Action / chip inside Search |
| Contribute | Removed — claim on property; add property via Profile (AUDITOR/ADMIN) |
| Settings | Profile (node, language, theme, account) |

**Per-page chrome (no global sticky brand bar on home):**

- **Search:** app name + large search bar + filter chips + map/list
- **Property:** full-screen route with back; View is primary, Audit secondary
- **Audit:** wizard chrome (draft / cancel / next) only

**Saved:** favorites only (local trip list). Traveler reports are not shown here.

## Non-goals (this redesign)

- Full offline PWA / mutation queue when the node is down
- In-app booking engine (external “Check availability” links only)
- Trips/itineraries (Saved remains favorites)
- Paid dark map tiles (OSM + CSS invert)
- Separate traveler-only vs auditor-only apps

## Audit catalogue (optimized)

Wizard steps: `entrance` → `mobility` → `room` → `bathroom` → `communication` → `review`

Boolean answers use **Yes / Partial / No / N/A** toggles (green/red accents). Each audit may **append** a new note (no confirm-other-people’s-notes). Photos: camera or gallery per step.

| Step | Fields |
|------|--------|
| Entrance | `step_free_entrance`, `automatic_door`, `ramp_present`, `door_width_cm`, `path_to_entrance` |
| Mobility | `elevator_present`, `elevator_width_cm`, `corridor_min_width_cm`, `parking_accessible`, `pool_lift` |
| Room | `room_types_available` (+ custom types), per type: `step_free_room`, `clear_space_beside_bed`, `bed_height_cm`, `turning_circle_cm`, `accessible_room_description` |
| Bathroom | `accessible_bathroom` (property), per room: `roll_in_shower`, `grab_bars_bathroom` |
| Communication | `hearing_loop`, `braille_signage`, `tactile_paving`, `visual_alarms`, `service_animal_policy` |
| Review | Summary + optional Extra: `quiet_hours_start` / `quiet_hours_end`, notes append, submit |

**Removed from active catalogue:** `accessible_room_count`, `elevator_floor_count` (simplify).

**Standard room types (short):** `single`, `double`, `twin`, `suite`, `family`. Auditors may add custom room type ids/labels.

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Access hub, audit photo scopes
- [RFC-0002](./rfcs/0002-global-hub-access.md) — home vs data node, viewport map
- [ROADMAP.md](./ROADMAP.md) — offline / booking strategy
