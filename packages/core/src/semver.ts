export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

export function parseSemver(version: string): SemverParts | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/** `-1` if a < b, `0` if equal, `1` if a > b; `null` when either side is unparsable. */
export function compareSemver(a: string, b: string): number | null {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) return null;
  if (left.major !== right.major) return left.major < right.major ? -1 : 1;
  if (left.minor !== right.minor) return left.minor < right.minor ? -1 : 1;
  if (left.patch !== right.patch) return left.patch < right.patch ? -1 : 1;
  return 0;
}

export function isSemverBelow(version: string, target: string): boolean {
  const cmp = compareSemver(version, target);
  return cmp != null && cmp < 0;
}

/** Absolute minor-version distance within the same major; `null` if unparsable or different majors. */
export function minorVersionGap(local: string, peer: string): number | null {
  const a = parseSemver(local);
  const b = parseSemver(peer);
  if (!a || !b) return null;
  if (a.major !== b.major) return null;
  return Math.abs(a.minor - b.minor);
}
