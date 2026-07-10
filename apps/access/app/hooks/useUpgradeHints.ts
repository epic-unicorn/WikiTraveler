"use client";

import { useEffect, useState } from "react";
import {
  assessClientNodeVersions,
  assessUpgrade,
  DEFAULT_RELEASE_MANIFEST_URL,
  type ReleaseManifest,
  type UpgradeAssessment,
} from "@wikitraveler/core";

const CLIENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

export function useUpgradeHints(nodeVersion: string | null | undefined) {
  const [manifest, setManifest] = useState<ReleaseManifest | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(DEFAULT_RELEASE_MANIFEST_URL, { signal: AbortSignal.timeout(8_000) })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.latest && data?.minRecommended) {
          setManifest(data as ReleaseManifest);
        }
      })
      .catch(() => {
        // advisory only
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clientNode = assessClientNodeVersions({
    clientVersion: CLIENT_VERSION,
    nodeVersion,
  });

  const nodeRelease =
    nodeVersion && manifest
      ? assessUpgrade({ currentVersion: nodeVersion, manifest })
      : { level: "ok" as const, message: null, latest: null, minRecommended: null };

  const hints: UpgradeAssessment[] = [clientNode, nodeRelease].filter(
    (item) => item.message != null
  );

  return {
    clientVersion: CLIENT_VERSION,
    manifest,
    hints,
  };
}
