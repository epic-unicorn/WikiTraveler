# Access UX redesign (IA + audit catalogue)

Product lock for the Access PWA redesign (shipped on `main`). Installable web manifest + icons landed; full offline SW / mutation queue remains a non-goal here — see [ROADMAP.md](./ROADMAP.md).

## Information architecture

**Bottom nav (mobile):** Search | Favorites | Contribute (AUDITOR/ADMIN only) | Profile

**Desktop chrome (≥900px):** icon-only left rail; Search shows map and list side-by-side; map pin opens a bottom sheet in the map column (scrolls the list to the same place); list hover highlights the map pin; Favorites uses a multi-column grid. Property/audit routes keep focus chrome (no side nav) with wider content. Tab and toolbar heroes share the same navy header padding and logo size; property loading skeleton follows the photo|sheet split on desktop.

| Former tab | New home |
|------------|----------|
| Near me | Locate control on Search map; requests location permission, then searches within **1 km** |
| Contribute | Contribute tab for auditors/admins; travelers add nothing here |
| Settings | Profile (node, language, theme, account) |
| Saved | Favorites (heart icon; search / sort) |

**Themes (named, no automatic/system):** Standard (WikiTraveler blue + white), Dark, High contrast, Calm.

**Search filters from profile:** accessibility preferences on Profile are applied as Advanced filters (on by default). They sit in a “From your profile” group with a person mark — turning one off is session-only and does not change the saved profile. Reset restores the profile defaults. Preference chips alone do not switch Search into query mode — pan/zoom still offers “Search this area”, and matching pins are filtered in the viewport.

**Per-page chrome (no global sticky brand bar on home):**

- **Search:** app name + large search bar + filter chips + map/list
- **Property:** full-screen route with back; View is primary, Audit secondary
- **Audit:** wizard chrome (draft / cancel / next) only

**Saved / Favorites:** synced to the signed-in home-node account (localStorage is a per-user cache). Traveler reports are not shown here. Search and sort apply on this list.

**Profile preferences:** accessibility chips and theme sync to the home node with the same local cache pattern.

**Notifications:** bell in the Access hero opens a short popup with a link to updates (resolved/dismissed reports).

## Non-goals (this redesign)

- Full offline PWA / mutation queue when the node is down
- In-app booking engine (external “Check availability” links only)
- Trips/itineraries (Saved remains favorites)
- Paid dark map tiles (OSM + CSS invert)
- Separate traveler-only vs auditor-only apps

## Audit catalogue (optimized)

Wizard steps: `entrance` → `mobility` → `room` → `bathroom` → `communication` → `review`

Boolean answers use **Yes / Partial / No / N/A** toggles (green/red accents). Stored tokens are `yes` / `partial` / `no` / `n/a` (OSM `true`/`false`/`limited` are canonicalized on load and submit). Each audit may **add a new visit note** (no confirm-other-people’s-notes; notes are not concatenated). Photos: camera or gallery per step. The wizard shows **existing photos for that step** (read-only; other auditors cannot delete them). Adding photos on a step replaces that slot on the property page. Property detail groups room facts **per audited room type** (labeled card + that type’s fields/photos).

A field audit writes **Verified**. **Confirmed** is only when ≥3 independent auditors agree on the same value — agreeing with an OSM prefill does not skip that threshold.

| Step | Fields |
|------|--------|
| Entrance | `step_free_entrance`, `automatic_door`, `ramp_present`, `door_width_cm`, `path_to_entrance` |
| Mobility | `elevator_present`, `elevator_width_cm`, `corridor_min_width_cm`, `parking_accessible`, `pool_lift` |
| Room | `room_types_available` (+ custom types), per type: `step_free_room`, `clear_space_beside_bed`, `bed_height_cm`, `turning_circle_cm`, `accessible_room_description` |
| Bathroom | `accessible_bathroom` (property), per room: `roll_in_shower`, `grab_bars_bathroom` |
| Communication | `hearing_loop`, `braille_signage`, `tactile_paving`, `visual_alarms`, `service_animal_policy` |
| Review | Summary + optional Extra: `quiet_hours_start` / `quiet_hours_end`, new visit note, submit |

**Removed from active catalogue:** `accessible_room_count`, `elevator_floor_count` (simplify).

**Standard room types (short):** `single`, `double`, `twin`, `suite`, `family`. Auditors may add custom room type ids/labels. Deselecting a custom type keeps the chip so it can be re-selected; the API accepts slug ids outside the five standards.

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Access hub, audit photo scopes
- [RFC-0002](./rfcs/0002-global-hub-access.md) — home vs data node, viewport map
- [ROADMAP.md](./ROADMAP.md) — offline Access / Store listing / signals loop
