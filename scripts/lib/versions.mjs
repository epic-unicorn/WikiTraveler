import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const WORKSPACE_PACKAGES = [
  "package.json",
  "apps/node/package.json",
  "apps/access/package.json",
  "packages/core/package.json",
  "packages/ui/package.json",
  "packages/i18n/package.json",
  "packages/ai-agent/package.json",
  "packages/sdk/package.json",
];

export function readRootPackageVersion() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  return pkg.version;
}

export function readVersionsManifest() {
  return JSON.parse(readFileSync(join(ROOT, "versions.json"), "utf8"));
}

export function writeVersionsManifest(manifest) {
  writeFileSync(join(ROOT, "versions.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

export function syncWorkspaceVersions(version) {
  for (const rel of WORKSPACE_PACKAGES) {
    const path = join(ROOT, rel);
    const pkg = JSON.parse(readFileSync(path, "utf8"));
    pkg.version = version;
    writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
  }
}

export function syncLensManifest(version) {
  const path = join(ROOT, "apps/lens/manifest.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.version = version;
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

export function updateVersionsJson(version, { releasedAt = null } = {}) {
  const current = readVersionsManifest();
  const manifest = {
    ...current,
    release: version,
    releasedAt,
    node: version,
    access: version,
    lens: version,
    sdk: version,
    minSupportedNode: current.minSupportedNode ?? version,
    minRecommendedNode: version,
  };
  writeVersionsManifest(manifest);
  return manifest;
}
