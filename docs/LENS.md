# Lens (Chrome extension)

WikiTraveler Lens injects accessibility facts on booking sites (Chrome MV3).

## Distribution today

| Channel | Status |
|---------|--------|
| Load unpacked (`apps/lens/`) | Dev / power users — see [LOCAL.md](./LOCAL.md) |
| GitHub Release zip `wikitraveler-lens-*.zip` | Every `v*` tag ([release.yml](../.github/workflows/release.yml)) |
| Chrome Web Store | **Planned** — maintainers upload the Release zip |
| Self-hosted signed CRX + `update_url` | Optional enterprise path (see below) |

## Chrome Web Store checklist (maintainers)

1. Build/tag a release so the Lens zip is attached to the GitHub Release.
2. Create/update the Web Store listing (privacy policy, screenshots, single purpose).
3. Upload the zip; set visibility (unlisted → public when ready).
4. Link the store URL from [README](../README.md) and this page when live.
5. Host permissions must match production OTAs + any first-party `wt-property-id` sites you support.

Do **not** commit `.pem` signing keys to git.

## Optional signed update channel

For fleets that cannot use the Web Store:

1. Pack a CRX with a dedicated private key (store the key offline).
2. Host `updates.xml` + CRX over HTTPS.
3. Add `"update_url": "https://…/updates.xml"` to a **distribution** copy of `manifest.json` (keep the open-source tree without a forced update URL so load-unpacked still works).

## i18n

Prefer updating [`packages/i18n`](../packages/i18n) and regenerating [`apps/lens/i18n.js`](../apps/lens/i18n.js) so locales do not drift.

## Related

- [apps/README.md](../apps/README.md) Flow 3  
- [FEDERATED-AUTH.md](./FEDERATED-AUTH.md) — same JWT rules when Lens talks to nodes  
- [ROADMAP.md](./ROADMAP.md) — Lens reach / Phase 6
