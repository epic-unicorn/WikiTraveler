# Product roadmap — WikiTraveler Access & community signals

Summary of planned work for **WikiTraveler Access** (traveler + auditor mobile app), community signals, and deferred email login.

**Status:** Complete — Phases 1–5 implemented in `apps/access`.

---

## Vision

**WikiTraveler Access** is the mobile app for verified accessibility on the go:

- **Travelers** discover real accessibility data, plan trips, and flag gaps — without waiting for auditor approval.
- **Auditors** verify access on-site, guided by community demand and dispute signals.
- **Admins** manage users, triage escalations, and configure the node.

Core promise: *Verified accessibility for travel — see what's real before you book, and help others if you're on the ground.*

Identity stays **`username@homeNodeUrl`** in the protocol. Username + password auth for now; email login deferred.

### Product family

| Product | Role |
|---------|------|
| **Node** | Regional mesh operator — API, dashboard, ingest |
| **Lens** | Accessibility on booking sites (browser extension) |
| **Access** | Accessibility in the field and on the go (mobile app) |

*Lens on the booking page. Access in your pocket.*

---

## What we are building

### 1. Open the app to all users

| Today | Target |
|-------|--------|
| WikiTraveler Access blocks `USER` at login | `USER`, `AUDITOR`, and `ADMIN` can sign in |
| Every property tap → audit wizard | Tap → **property detail** (read-first) |
| Auditor-only positioning | Accessibility companion that *includes* on-site verification |

**Auth changes**

- Allow `USER` role past login (`canAccessApp` → role-aware access).
- Gate **write** actions only: full audit submit, add property, auditor queue.
- API already enforces `AUDITOR` on `POST /api/properties/:id/accessibility` — UI follows the same split.

**New property detail screen**

- Tier badges per field (`OFFICIAL` → `CONFIRMED`).
- “Last verified” / “Not yet audited” context.
- Role-aware actions: Save, Share, Report issue, Start audit (auditors only).
- Deep links: `/properties/[id]` (read) vs `/audit/[id]` (contribute).

---

### 2. Navigation & features by persona

**Tabs (proposed)**

| Tab | Everyone | Auditor-only |
|-----|----------|--------------|
| **Explore** | Search + map (current Search tab) | — |
| **Nearby** | GPS hotels + accessibility filters | “Audit next gap nearby” chip |
| **Saved** | Trips / saved places / recent views | Recent audits subsection |
| **Contribute** | “Become an auditor” CTA | Queue, stats, add property (`+`) |
| **Settings** | Node URL, locale, account, sign out | Same |

**Traveler features (phased)**

- Saved places / trip lists with must-have accessibility filters.
- Share property links.
- Compare 2–3 properties side by side.
- Offline cache of recently viewed properties (later phase).

**Auditor features (keep + extend)**

- Existing audit wizard (photos, rooms, drafts).
- Quick audit checklist (later).
- Auditor queue fed by community signals (see §3).
- Contribution stats (later).

---

### 3. Community signals (users → auditors)

Travelers **inform** auditors and admins; they do **not** change displayed facts directly.

**Principle:** Signals are triage metadata. Only auditor submissions create or update `AccessibilityFact` rows at `VERIFIED` / `CONFIRMED` tiers.

**Report types (v1)**

| Type | Example |
|------|---------|
| **Missing** | No on-site audit; room-level data absent |
| **Incorrect** | Shown value doesn't match reality |
| **Outdated** | Renovation, broken lift, moved entrance |
| **Location** | Wrong pin, duplicate, closed property → admin escalation |
| **Demand** | “I need this field” — priority heat, not a dispute |

**User flow**

- From property detail: per-field “Report issue” or property-level “Flag missing access info”.
- Short form: type, optional field, note, optional suggested value, optional photo (max 2), optional visit date.
- Copy: *“Goes to regional auditors — won't change what others see until verified.”*
- **My reports** tab: open / addressed / dismissed.

**Auditor & admin queue (node dashboard)**

- New **Community signals** panel: property, type, field, current value + tier, priority score, status, age.
- Actions: start audit, in progress, resolve (link submission), dismiss (with reason).
- Priority scoring: incorrect on `VERIFIED`, duplicate reporters, popular search filters, geographic clusters.

**Data model (new)**

```
CommunitySignal
  propertyId, type, status
  fieldName?, scopeKey?
  currentValue?, currentTier?   // snapshot at report time
  suggestedValue?              // hint only, not a fact
  note?, visitDate?, photos
  reporterId                   // username@homeNodeUrl
  resolvedBy?, resolution?, resolvedAt?
```

**API (new)**

| Endpoint | Role |
|----------|------|
| `POST /api/properties/:id/signals` | `USER`+ |
| `GET /api/properties/:id/signals` | `USER`+ (own + aggregate counts) |
| `GET /api/admin/signals` | `AUDITOR`+ |
| `PATCH /api/admin/signals/:id` | `AUDITOR`+ |

**Guardrails**

- Login required; rate limits per user.
- One open signal per (property, field, reporter) — update instead of spam.
- Never promote signals to facts; never gossip raw signals to peers (v1).
- Photos on signals stay internal until tied to a verified audit.

---

### 4. Rebrand: Field Kit → WikiTraveler Access

| Item | Change |
|------|--------|
| Product name | **WikiTraveler Access** (slug: `access`) |
| Positioning | Verified accessibility for travel — browse, verify, flag gaps |
| Login copy | “Sign in to explore verified accessibility” |
| Repo path | `apps/access` (renamed from `apps/field-kit`) |
| i18n / logo | New `WikiTravelerLogo` product variant (`product="access"`) |

Lens remains the browser extension; Access is the mobile mesh client.

---

## Phased delivery

### Phase 1 — Open the doors

- [x] Allow `USER` login in Access / WikiTraveler Access
- [x] Property detail screen (read-only facts + tiers)
- [x] Search/Nearby link to detail, not straight to audit
- [x] Update login/register copy and role-aware toolbar (`+` auditors only)

### Phase 2 — Community signals (MVP)

- [x] `CommunitySignal` Prisma model + migration
- [x] `POST` / `GET` signals API + admin queue API
- [x] “Report issue” on property detail
- [x] **Community signals** panel on node admin
- [x] Dedup + rate limits

### Phase 3 — Traveler value

- [x] Saved places / trips
- [x] Share links
- [x] “My reports” in app
- [x] Signal priority scoring

### Phase 4 — Contributor polish

- [x] Auditor queue integration (start audit from signal)
- [x] Photos + visit date on signals
- [x] Contribution stats
- [x] Lens “Report issue” button (same API)

### Phase 5 — Rebrand & hardening

- [x] Rename app package, docker service, docs (`access`)
- [x] `nodeinfo.features` flags (e.g. `communitySignals`, `passwordResetEmail`)
- [x] Offline cache (optional)

---

## Explicitly deferred

### Email login & password reset

Not in scope until a later iteration.

**Deferred items**

- `email` field on `User`
- Forgot / reset password via email
- Login with email instead of username
- Per-node mail provider (Resend, SMTP) and DNS setup

**Until then**

- Username + password only
- Admin sets/resets passwords via Users panel (`PATCH /api/admin/users/:username`)
- “Forgot password?” → contact node admin

Email is **optional per node** when built — nodes without mail config keep current behavior.

---

## Impact

| Area | Effect |
|------|--------|
| **Users** | Instant registration; browse accessibility on mobile without auditor approval |
| **Auditors** | Prioritized queue from real traveler demand and disputes |
| **Admins** | Less manual triage; signals surface wrong/missing access data |
| **Mesh** | More discovery → more audits → fresher `VERIFIED` / `CONFIRMED` data |
| **Trust model** | Unchanged — signals never bypass tier rules |
| **Lens** | Same data; optional report entry point in Phase 4 |

---

## Out of scope (for this roadmap)

- Cross-node single sign-on
- User-submitted facts at any tier
- Crowd voting that overrides `CONFIRMED`
- Centralized WikiTraveler mail service
- Public exposure of reporter identities

---

## Related docs

- [README](../README.md) — reliability tiers and toolkit overview
- [apps/README](../apps/README.md) — WikiTraveler Access flows (traveler + auditor)
- [LOCAL.md](./LOCAL.md) — development setup
- [VERCEL.md](./VERCEL.md) — production deployment
