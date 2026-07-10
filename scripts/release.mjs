#!/usr/bin/env node
/**
 * Prepare a WikiTraveler release locally.
 *
 * Usage:
 *   node scripts/release.mjs 0.3.0
 *   node scripts/release.mjs 0.3.0 --tag   # also create annotated git tag v0.3.0
 *
 * Does not push — maintainer reviews, commits, then:
 *   git push && git push origin v0.3.0
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  readRootPackageVersion,
  syncLensManifest,
  syncWorkspaceVersions,
  updateVersionsJson,
} from "./lib/versions.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.log(`Usage: node scripts/release.mjs <version> [--tag]

Example:
  node scripts/release.mjs 0.3.0
  node scripts/release.mjs 0.3.0 --tag

Before tagging, update CHANGELOG.md [Unreleased] and from repo root run:
  pnpm install && pnpm exec prisma generate && pnpm test && pnpm build
See docs/RELEASES.md — Maintainer release checklist.
`);
}

const args = process.argv.slice(2).filter((a) => a !== "--");
const version = args.find((a) => !a.startsWith("--"));
const shouldTag = args.includes("--tag");

if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  usage();
  process.exit(1);
}

const current = readRootPackageVersion();
if (current === version) {
  console.log(`Version already ${version} — syncing manifests only.`);
} else {
  console.log(`Bumping ${current} → ${version}`);
}

syncWorkspaceVersions(version);
syncLensManifest(version);
const manifest = updateVersionsJson(version);
touchChangelogReminder(version);

console.log("\nUpdated:");
console.log("  package.json (root + workspaces)");
console.log("  apps/lens/manifest.json");
console.log("  versions.json");
console.log("  releases/manifest.json");
console.log("\nversions.json:");
console.log(JSON.stringify(manifest, null, 2));
console.log("\nNext steps (see docs/RELEASES.md):");
if (current !== version) {
  console.log("  1. Edit CHANGELOG.md — move [Unreleased] into [" + version + "]");
  console.log("  2. git add -A && git commit -m \"chore: release v" + version + "\" && open PR → merge to main");
  console.log("  3. On main after merge:");
} else {
  console.log("  1. On main (version already " + version + " — skip bump commit if merged):");
}
const stepBase = current !== version ? 3 : 1;
console.log("  " + stepBase + ". git checkout main && git pull");
console.log("  " + (stepBase + 1) + ". pnpm install && pnpm exec prisma generate");
console.log("  " + (stepBase + 2) + ". pnpm test && pnpm build");
if (shouldTag) {
  const tag = `v${version}`;
  execSync(`git tag -a ${tag} -m "Release ${tag}"`, { cwd: ROOT, stdio: "inherit" });
  console.log("  " + (stepBase + 3) + ". git push origin " + tag);
} else {
  console.log("  " + (stepBase + 3) + ". node scripts/release.mjs " + version + " --tag");
  console.log("  " + (stepBase + 4) + ". git push origin v" + version);
}

function touchChangelogReminder(nextVersion) {
  const changelogPath = join(ROOT, "CHANGELOG.md");
  const text = readFileSync(changelogPath, "utf8");
  if (text.includes(`## [${nextVersion}]`)) return;
  console.log(`\nReminder: add ## [${nextVersion}] section to CHANGELOG.md before tagging.`);
}
