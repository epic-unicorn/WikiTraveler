# @wikitraveler/sdk

Embed WikiTraveler accessibility facts on agency / OTA websites.

## Install (npm — from tagged releases)

```bash
npm install @wikitraveler/sdk
# or
pnpm add @wikitraveler/sdk
```

Publishing runs on `v*` tags when repo variable `NPM_PUBLISH=true` and [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) is configured for `.github/workflows/release.yml`. CI runs `npm stage publish`; a maintainer then approves the staged package with 2FA on npmjs.com (or `npm stage approve`). Until then, use the **SDK files attached to the GitHub Release** or the UMD build below.

## Usage

### ESM / bundlers

```ts
import { WikiTraveler } from "@wikitraveler/sdk";

const wt = new WikiTraveler({ nodeUrl: "https://node.example.org" });
const data = await wt.getAccessibility("osm:123");
```

### UMD / script tag

```html
<script src="https://github.com/ingmarstruijs/WikiTraveler/releases/download/v0.5.0/wikitraveler.umd.js"></script>
<script>
  const wt = new WikiTraveler({ nodeUrl: "https://node.example.org" });
</script>
```

(Exact asset names follow the Release upload — see [docs/RELEASES.md](../../docs/RELEASES.md).)

## Accessibility

When mounting the widget, provide a visible heading and follow [docs/ACCESSIBILITY.md](../../docs/ACCESSIBILITY.md).

## Development

```bash
pnpm --filter @wikitraveler/core build
pnpm --filter @wikitraveler/i18n build
pnpm --filter @wikitraveler/sdk build
```

The published package **bundles** `@wikitraveler/core` and `@wikitraveler/i18n` so consumers do not need workspace packages.
