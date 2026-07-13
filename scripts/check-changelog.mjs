#!/usr/bin/env node
/**
 * Light CHANGELOG gate for PRs.
 *
 * Fails when the diff (base...HEAD) touches user/operator-facing product paths
 * but does not modify CHANGELOG.md.
 *
 * Usage:
 *   node scripts/check-changelog.mjs [baseRef]
 *
 * Escape hatches:
 *   - PR label `skip-changelog` (GitHub Actions sets SKIP_CHANGELOG=1)
 *   - SKIP_CHANGELOG=1 in the environment
 */

import { execSync } from "node:child_process";

const baseRef = process.argv[2] || "origin/main";

if (process.env.SKIP_CHANGELOG === "1" || process.env.SKIP_CHANGELOG === "true") {
  console.log("check-changelog: skipped (SKIP_CHANGELOG set)");
  process.exit(0);
}

function git(args) {
  return execSync(`git ${args}`, { encoding: "utf8" }).trim();
}

let changed;
try {
  changed = git(`diff --name-only ${baseRef}...HEAD`)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
} catch (err) {
  console.error(`check-changelog: cannot diff against ${baseRef}`);
  console.error(String(err?.message || err));
  process.exit(2);
}

if (changed.length === 0) {
  console.log("check-changelog: no file changes");
  process.exit(0);
}

const TRIGGER_PREFIXES = [
  "apps/access/",
  "apps/lens/",
  "apps/node/app/",
  "packages/i18n/",
  "packages/ui/",
  "packages/ai-agent/",
  "packages/core/",
  "packages/sdk/",
  "prisma/",
  "docker/",
];

const IGNORE_IF_ONLY = [
  /^docs\//,
  /^\.github\//,
  /^AGENTS\.md$/,
  /^CONTRIBUTING\.md$/,
  /^SECURITY\.md$/,
  /^CODEOWNERS$/,
  /^scripts\/check-changelog\.mjs$/,
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\/test\//,
  /\/__tests__\//,
];

function isTrigger(path) {
  if (!TRIGGER_PREFIXES.some((p) => path.startsWith(p))) return false;
  if (IGNORE_IF_ONLY.some((re) => re.test(path))) return false;
  return true;
}

const triggers = changed.filter(isTrigger);
const changelogTouched = changed.includes("CHANGELOG.md");

if (triggers.length === 0) {
  console.log("check-changelog: no user-facing product paths in diff — ok");
  process.exit(0);
}

if (changelogTouched) {
  console.log(
    `check-changelog: CHANGELOG.md updated (${triggers.length} product path(s)) — ok`
  );
  process.exit(0);
}

console.error(`check-changelog: FAIL

This PR changes user/operator-facing paths but does not update CHANGELOG.md:

${triggers.map((f) => `  - ${f}`).join("\n")}

Add a bullet under CHANGELOG.md → ## [Unreleased] (see AGENTS.md),
or apply the PR label \`skip-changelog\` if this truly has no ship-facing impact.
`);
process.exit(1);
