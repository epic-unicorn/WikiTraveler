# Accessibility (EAA / EN 301 549)

**Docs:** [Hub](./README.md) · [Development](./DEVELOPMENT.md) · [Conformance](./CONFORMANCE.md)

WikiTraveler targets **WCAG 2.1 Level AA** via EN 301 549 for all user-facing surfaces:

| App | Audience |
| --- | --- |
| Lens | Travelers on booking sites |
| WikiTraveler Access | Travelers + on-site auditors |
| Node dashboard | Operators |
| Agency demo + SDK widget | Partner integrations |

## Implemented patterns

- `lang="en"` on all HTML shells
- Skip links on Node (`AppShell`) and WikiTraveler Access
- `:focus-visible` rings via `@wikitraveler/ui/accessibility.css`
- Form labels (`htmlFor` / visually hidden labels)
- `role="alert"` on auth and submission errors; `role="status"` on success and loading
- `aria-pressed` on search filter chips
- `aria-expanded` / keyboard `<button>` on expandable rows and map property list
- Lens listing cards: keyboard-focusable **A11y** trigger (in addition to hover tooltips)
- Lens popup: `<main>`, facts table `<th scope="col">`, search toggle with `aria-controls`
- WikiTraveler Access: WAI-ARIA tabs with arrow-key navigation
- Map: `aria-label` on map region; text yes/no labels in popups (not emoji)
- SDK widget: `role="region"`, table headers with `scope`, `aria-live` loading/errors
- `prefers-reduced-motion` CSS in shared UI, Lens, and agency demo
- Tier badges: text labels + improved contrast (Official tier)
- Dynamic page titles on node property pages and WikiTraveler Access audit routes
- Public accessibility statement at `/accessibility`

## Automated tests

```bash
pnpm test:a11y          # axe-core pattern tests
pnpm lighthouse:ci      # Lighthouse accessibility ≥ 90 (requires running node + access)
```

- **axe-core** — login forms, map list, SDK table, agency tabs, Lens table (`apps/node/lib/a11yStatic.test.ts`)
- **Lighthouse** — `/accessibility`, `/login`, node home, WikiTraveler Access login + property detail (`.github/workflows/a11y.yml`)
- Run `pnpm lighthouse:prepare` then `pnpm lighthouse:ci` to provision CI auth cookies (see `scripts/prepare-lighthouse.ts`)

Formal conformance report: [docs/CONFORMANCE.md](./CONFORMANCE.md) (EN 301 549 / WCAG 2.1 AA).

## Manual test checklist (each release)

1. Keyboard-only walkthrough of login, search, audit submit, Lens popup
2. NVDA or VoiceOver on WikiTraveler Access audit flow
3. 200% browser zoom — no clipped content on WikiTraveler Access / Lens popup
4. Lighthouse accessibility ≥ 90 on node home and Access property detail

## Embedding the SDK accessibly

When partners mount `WikiTraveler.mountWidget()`:

1. Provide a **visible heading** near the widget (e.g. “Accessibility information”).
2. The widget renders a `role="region"` labelled “WikiTraveler accessibility data”.
3. Loading and error states are announced via `aria-live` / `role="alert"`.
4. Trust tiers include **text labels**, not color alone.
5. Do not hide the widget behind hover-only interactions — keep it in the normal document flow.

Example:

```html
<h2 id="a11y-heading">Accessibility</h2>
<div id="wt-widget"
     data-wt-widget
     data-property-id="PROP_ID"
     data-node-url="https://node.example.com"
     aria-labelledby="a11y-heading"></div>
```

## Feedback

Report accessibility barriers via your node operator or the [GitHub issue tracker](https://github.com/wikitraveler/wikitraveler/issues/new). Include:

- App (Lens / WikiTraveler Access / Node / SDK)
- Browser + assistive technology
- Steps to reproduce

## Known gaps

- Third-party booking site DOM constraints for Lens overlays (see [CONFORMANCE.md](./CONFORMANCE.md) §5)

## Public statement

Node operators can link to `/accessibility` on their deployed node for the public accessibility statement.
