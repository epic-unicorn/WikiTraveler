import { compareSemver, isSemverBelow } from "./semver";

export type UpgradeLevel = "ok" | "info" | "warn";

export interface ReleaseManifest {
  latest: string;
  minRecommended: string;
  releasedAt?: string | null;
  node?: string;
  access?: string;
  lens?: string;
  sdk?: string;
  gossipProtocol?: number;
  exportSchema?: number;
  minSupportedNode?: string;
}

export interface UpgradeAssessment {
  level: UpgradeLevel;
  message: string | null;
  latest: string | null;
  minRecommended: string | null;
}

export const DEFAULT_RELEASE_MANIFEST_URL =
  "https://raw.githubusercontent.com/ingmarstruijs/WikiTraveler/main/releases/manifest.json";

export function assessUpgrade(params: {
  currentVersion: string;
  manifest: Pick<ReleaseManifest, "latest" | "minRecommended"> | null;
}): UpgradeAssessment {
  const { currentVersion, manifest } = params;
  if (!manifest || currentVersion === "dev") {
    return { level: "ok", message: null, latest: manifest?.latest ?? null, minRecommended: manifest?.minRecommended ?? null };
  }

  const { latest, minRecommended } = manifest;

  if (isSemverBelow(currentVersion, minRecommended)) {
    return {
      level: "warn",
      message: `This node is ${currentVersion}; ${minRecommended} or newer is recommended.`,
      latest,
      minRecommended,
    };
  }

  const behindLatest = compareSemver(currentVersion, latest);
  if (behindLatest != null && behindLatest < 0) {
    return {
      level: "info",
      message: `WikiTraveler ${latest} is available (you are on ${currentVersion}).`,
      latest,
      minRecommended,
    };
  }

  return { level: "ok", message: null, latest, minRecommended };
}

export function assessClientNodeVersions(params: {
  clientVersion: string;
  nodeVersion: string | null | undefined;
}): UpgradeAssessment {
  const { clientVersion, nodeVersion } = params;
  if (!nodeVersion || clientVersion === "dev" || nodeVersion === "dev") {
    return { level: "ok", message: null, latest: null, minRecommended: null };
  }

  const cmp = compareSemver(clientVersion, nodeVersion);
  if (cmp == null) {
    return { level: "ok", message: null, latest: null, minRecommended: null };
  }

  if (cmp > 0) {
    return {
      level: "warn",
      message: `Access ${clientVersion} is newer than the connected node (${nodeVersion}). Upgrade the node or point Access at a newer deployment.`,
      latest: null,
      minRecommended: null,
    };
  }

  if (cmp < 0) {
    return {
      level: "info",
      message: `The connected node (${nodeVersion}) is newer than this Access build (${clientVersion}). Rebuild Access to match.`,
      latest: null,
      minRecommended: null,
    };
  }

  return { level: "ok", message: null, latest: null, minRecommended: null };
}
