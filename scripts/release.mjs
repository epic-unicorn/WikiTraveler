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

Before tagging, update CHANGELOG.md [Unreleased] and run:
  pnpm test && pnpm build
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
console.log("\nversions.json:");
console.log(JSON.stringify(manifest, null, 2));
console.log("\nNext steps:");
console.log("  1. Edit CHANGELOG.md — move [Unreleased] into [" + version + "]");
console.log("  2. pnpm test && pnpm build");
console.log("  3. git add -A && git commit -m \"chore: release v" + version + "\"");
if (shouldTag) {
  const tag = `v${version}`;
  execSync(`git tag -a ${tag} -m "Release ${tag}"`, { cwd: ROOT, stdio: "inherit" });
  console.log(`  4. git push && git push origin ${tag}`);
} else {
  console.log(`  4. node scripts/release.mjs ${version} --tag   # or: git tag -a v${version} -m \"Release v${version}\"`);
  console.log("  5. git push && git push origin v" + version);
}

function touchChangelogReminder(nextVersion) {
  const changelogPath = join(ROOT, "CHANGELOG.md");
  const text = readFileSync(changelogPath, "utf8");
  if (text.includes(`## [${nextVersion}]`)) return;
  console.log(`\nReminder: add ## [${nextVersion}] section to CHANGELOG.md before tagging.`);
}
