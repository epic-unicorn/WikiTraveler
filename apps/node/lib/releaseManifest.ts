import {
  assessUpgrade,
  DEFAULT_RELEASE_MANIFEST_URL,
  type ReleaseManifest,
} from "@wikitraveler/core";

const ALLOWED_MANIFEST_HOSTS = new Set([
  "raw.githubusercontent.com",
  "github.com",
  "objects.githubusercontent.com",
]);

const MANIFEST_FETCH_TIMEOUT_MS = 8_000;

function resolveManifestUrl(): string {
  return process.env.RELEASE_MANIFEST_URL?.trim() || DEFAULT_RELEASE_MANIFEST_URL;
}

function isAllowedManifestUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    return ALLOWED_MANIFEST_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export async function fetchReleaseManifest(): Promise<ReleaseManifest | null> {
  const url = resolveManifestUrl();
  if (!isAllowedManifestUrl(url)) return null;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(MANIFEST_FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ReleaseManifest;
    if (!data.latest || !data.minRecommended) return null;
    return data;
  } catch {
    return null;
  }
}

export { assessUpgrade, DEFAULT_RELEASE_MANIFEST_URL };
