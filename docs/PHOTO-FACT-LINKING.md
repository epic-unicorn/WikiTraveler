# Photo evidence for audits (step-level)

Photos attach to the **audit step** (or room type) where they were captured — not to individual fact rows.

## Model

| Scope key | Meaning |
|-----------|---------|
| `step:building_access` | Photos added on Building access |
| `step:shared_facilities` | Photos added on Shared facilities |
| `room-type:<id>` | Photos for a selected room type |
| (none / general) | Legacy or unscoped photos |

Auditors do **not** pick a per-fact “Photo shows” tag. Review shows a simple grouped summary.

## Display

- Property detail: step/room photos appear once under the matching section.
- Existing data panel: photos grouped by step / room type.
- Per-fact strips only when a photo has an explicit `fieldName` (legacy / rare).

## Related

- Wizard: `apps/access/app/audit/[id]/AuditWizard.tsx`
- Helpers: `apps/access/app/lib/propertyFacts.ts`
