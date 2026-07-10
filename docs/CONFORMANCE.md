# WikiTraveler Accessibility Conformance Report

**Docs:** [Hub](./README.md) · [Accessibility checklist](./ACCESSIBILITY.md)

**Product:** WikiTraveler (open-source federated accessibility intelligence for travel)  
**Report version:** 1.0  
**Evaluation date:** June 2026  
**Contact:** [GitHub Issues](https://github.com/wikitraveler/wikitraveler/issues/new) (accessibility label)  
**Applicable standards:** [EN 301 549 v3.2.1](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/) (EU) · [WCAG 2.1 Level AA](https://www.w3.org/TR/WCAG21/)

---

## 1. Executive summary

WikiTraveler publishes structured hotel accessibility facts through multiple surfaces: a **Node** operator dashboard, **WikiTraveler Access** mobile app (travelers + auditors), **Lens** browser extension, and an embeddable **SDK widget** for partner sites.

This report documents conformance against **WCAG 2.1 Level AA**, the web baseline referenced by **EN 301 549** for the European Accessibility Act (EAA). WikiTraveler’s **target** conformance level is **Partially conformant** with WCAG 2.1 AA: primary user journeys have been remediated and are covered by automated regression tests; known limitations remain on third-party host pages (Lens) and the interactive map.

| Surface | Role | Conformance (target) |
| --- | --- | --- |
| Node dashboard | Operators / auditors | **Partially conformant** |
| WikiTraveler Access | Travelers + on-site auditors | **Partially conformant** |
| Lens popup & options | Travelers | **Partially conformant** |
| Lens listing overlays | Travelers on booking sites | **Partially conformant** |
| Agency demo + SDK widget | Partner integrations | **Partially conformant** |

**Partially conformant** means some content does not fully conform, as described in §4 and §5.

---

## 2. Scope of product and evaluation

### 2.1 In scope

| Component | Path | Version evaluated |
| --- | --- | --- |
| Node | `apps/node` | 0.1.0 |
| WikiTraveler Access | `apps/access` | 0.1.0 |
| Lens | `apps/lens` | MV3 extension |
| SDK widget | `packages/sdk` | 0.1.0 |
| Shared UI | `packages/ui` | 0.1.0 |

### 2.2 Out of scope

- Third-party booking websites (Booking.com, Expedia, etc.) where Lens injects overlays — host site accessibility is not evaluated here.
- Backend APIs without a user interface.
- Operator-customised themes beyond default WikiTraveler tokens.

### 2.3 Evaluation methods

| Method | Coverage |
| --- | --- |
| Static code review | All in-scope surfaces |
| axe-core automated tests | Representative HTML patterns (`pnpm test:a11y`) |
| Lighthouse accessibility (≥ 90) | Node `/accessibility`, `/login`, `/`; WikiTraveler Access `/login`, `/audit/[id]` (CI) |
| Manual checklist | Keyboard, screen reader, 200% zoom (per release — see [ACCESSIBILITY.md](./ACCESSIBILITY.md)) |

---

## 3. Terms

The terms **Supports**, **Partially Supports**, **Does Not Support**, and **Not Applicable** follow the [ITI VPAT](https://www.itic.org/policy/accessibility/vpat) definitions:

- **Supports** — functionality is available with no known defects for the criterion.
- **Partially Supports** — some functionality meets the criterion; exceptions are noted.
- **Does Not Support** — majority of functionality does not meet the criterion.
- **Not Applicable** — criterion does not apply to the product.

---

## 4. WCAG 2.1 Level AA — summary by principle

### 4.1 Perceivable

| Criterion | Node | WikiTraveler Access | Lens | SDK |
| --- | --- | --- | --- | --- |
| 1.1.1 Non-text Content | Supports | Supports | Partially Supports | Supports |
| 1.3.1 Info and Relationships | Supports | Supports | Supports | Supports |
| 1.3.2 Meaningful Sequence | Supports | Supports | Supports | Supports |
| 1.4.1 Use of Color | Supports | Supports | Supports | Supports |
| 1.4.3 Contrast (Minimum) | Supports | Supports | Supports | Supports |
| 1.4.4 Resize Text | Supports | Supports | Supports | Supports |
| 1.4.10 Reflow | Supports | Partially Supports | Partially Supports | Supports |
| 1.4.11 Non-text Contrast | Supports | Supports | Supports | Supports |
| 1.4.13 Content on Hover/Focus | Supports | Supports | Partially Supports | Supports |

**Notes**

- Tier badges use text labels, not color alone (`packages/ui`, SDK widget).
- Lens listing **hover tooltips** remain a supplemental path; keyboard **A11y** buttons on cards provide an equivalent route to facts.
- Official-tier contrast was raised to meet AA in shared tokens.

### 4.2 Operable

| Criterion | Node | WikiTraveler Access | Lens | SDK |
| --- | --- | --- | --- | --- |
| 2.1.1 Keyboard | Partially Supports | Supports | Partially Supports | Supports |
| 2.1.2 No Keyboard Trap | Supports | Supports | Supports | Supports |
| 2.4.1 Bypass Blocks | Supports | Supports | Not Applicable | Not Applicable |
| 2.4.2 Page Titled | Supports | Supports | Supports | Not Applicable |
| 2.4.3 Focus Order | Supports | Supports | Supports | Supports |
| 2.4.4 Link Purpose | Supports | Supports | Supports | Supports |
| 2.4.6 Headings and Labels | Supports | Supports | Supports | Supports |
| 2.4.7 Focus Visible | Supports | Supports | Supports | Supports |
| 2.5.5 Target Size | Supports | Supports | Supports | Not Applicable |

**Notes**

- Node **Leaflet map** is pointer-primary; a keyboard-accessible property list is provided as an alternative.
- Skip links on Node (`AppShell`) and WikiTraveler Access.
- WikiTraveler Access tab bar implements WAI-ARIA tabs with arrow-key navigation.

### 4.3 Understandable

| Criterion | Node | WikiTraveler Access | Lens | SDK |
| --- | --- | --- | --- | --- |
| 3.1.1 Language of Page | Supports | Supports | Supports | Supports |
| 3.2.1 On Focus | Supports | Supports | Supports | Supports |
| 3.2.2 On Input | Supports | Supports | Supports | Supports |
| 3.3.1 Error Identification | Supports | Supports | Supports | Supports |
| 3.3.2 Labels or Instructions | Supports | Supports | Supports | Supports |
| 3.3.3 Error Suggestion | Partially Supports | Partially Supports | Partially Supports | Partially Supports |

**Notes**

- Auth and submission errors use `role="alert"`; success uses `role="status"` / `aria-live`.
- All auth flows use associated `<label>` elements or `aria-label`.

### 4.4 Robust

| Criterion | Node | WikiTraveler Access | Lens | SDK |
| --- | --- | --- | --- | --- |
| 4.1.1 Parsing | Supports | Supports | Supports | Supports |
| 4.1.2 Name, Role, Value | Supports | Supports | Supports | Supports |
| 4.1.3 Status Messages | Supports | Supports | Supports | Supports |

---

## 5. Known limitations (does not support / partial)

| ID | Surface | WCAG / EN issue | Workaround / plan |
| --- | --- | --- | --- |
| L-01 | Lens on booking sites | Host DOM may clip or obscure injected overlays; hover tooltips not keyboard-only | Use Lens **popup panel** or per-card **A11y** button |
| L-02 | Node map | Leaflet map markers not fully keyboard-operable | Expandable **keyboard property list** below map |
| L-03 | WikiTraveler Access | 200% zoom may clip long audit panels on very narrow viewports | Collapsible Existing Data panel; tabbed layout |
| L-04 | All | Error suggestions are generic, not field-specific | Future enhancement |
| L-05 | Lens listing | Decorative emoji in empty states | Text labels present alongside |

---

## 6. EN 301 549 mapping (selected clauses)

EN 301 549 Clause 9 adopts WCAG 2.1 Level AA for web content. WikiTraveler web surfaces map as follows:

| EN 301 549 clause | Requirement | WikiTraveler status |
| --- | --- | --- |
| 9.1–9.4 | WCAG 2.1 A/AA perceivable | See §4.1 |
| 10.1–10.5 | WCAG 2.1 operable | See §4.2 |
| 11.1–11.6 | WCAG 2.1 understandable | See §4.3 |
| 12.1–12.2 | WCAG 2.1 robust | See §4.4 |
| 12.1.2 (docs) | Product documentation accessibility | [ACCESSIBILITY.md](./ACCESSIBILITY.md), this report |
| 12.2.4 (public statement) | Accessibility statement published | Node `/accessibility` (public, no login) |

Non-web clauses (hardware, closed products) are **Not Applicable**.

---

## 7. Automated conformance gates

| Gate | Command | Threshold |
| --- | --- | --- |
| axe-core patterns | `pnpm test:a11y` | Zero critical/serious violations on fixtures |
| Lighthouse accessibility | `pnpm lighthouse:ci` | Score ≥ 90 per URL (CI) |

CI workflow: `.github/workflows/a11y.yml`

---

## 8. Feedback and remediation process

1. Report via [GitHub Issues](https://github.com/wikitraveler/wikitraveler/issues/new) or node operator contact (see `/accessibility`).
2. Triage within one sprint; P0 keyboard/blocker issues prioritised.
3. Fix verified by axe/Lighthouse CI plus manual keyboard/screen-reader spot check.
4. This report updated on major releases.

---

## 9. Legal disclaimer

This report is based on evaluation of the WikiTraveler open-source codebase at the date above. Deployed instances may differ if operators customise themes, disable features, or run outdated versions. **Partially conformant** is an honest assessment — not a legal guarantee of EAA compliance in every deployment context.

---

## 10. Document history

| Version | Date | Changes |
| --- | --- | --- |
| 1.0 | June 2026 | Initial report after Phase 0–3 remediation programme |
