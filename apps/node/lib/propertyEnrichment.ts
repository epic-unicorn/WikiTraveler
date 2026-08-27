import type { Property } from "@prisma/client";

type FactLike = { fieldName: string; tier: string; timestamp?: string };

export type PropertyDetailPayload = {
  id: string;
  name: string;
  location: string;
  lat: number | null;
  lon: number | null;
  osmId: string | null;
  wheelmapId: string | null;
  address: string;
  description: string | null;
  website: string | null;
  sourceLinks: Array<{ label: string; url: string }>;
  photos: Array<{ url: string; caption: string | null; source: string }>;
  claimedByUserId?: string | null;
  claimedAt?: string | null;
  isClaimedByMe?: boolean;
};

export function buildPropertyDetail(
  property: Property & { claimedByUserId?: string | null; claimedAt?: Date | null },
  facts: FactLike[],
  auditPhotoUrls: Array<{ url: string; caption: string | null }>
): PropertyDetailPayload {
  const sourceLinks: Array<{ label: string; url: string }> = [];

  if (property.osmId) {
    const osmRef = property.osmId.replace(/^node\//, "");
    sourceLinks.push({
      label: "OpenStreetMap",
      url: `https://www.openstreetmap.org/node/${osmRef}`,
    });
  }
  if (property.wheelmapId) {
    sourceLinks.push({
      label: "Wheelmap",
      url: `https://wheelmap.org/nodes/${property.wheelmapId}`,
    });
  }

  const photos = auditPhotoUrls.map((p) => ({
    url: p.url,
    caption: p.caption,
    source: "audit",
  }));

  return {
    id: property.id,
    name: property.name,
    location: property.location,
    lat: property.lat,
    lon: property.lon,
    osmId: property.osmId,
    wheelmapId: property.wheelmapId,
    address: property.location,
    description: null,
    website: null,
    sourceLinks,
    photos,
    claimedByUserId: property.claimedByUserId ?? null,
    claimedAt: property.claimedAt?.toISOString() ?? null,
  };
}

export function buildConfidenceSummary(
  facts: FactLike[],
  lastAuditAt: string | null
): {
  verifiedCount: number;
  aiGuessCount: number;
  officialCount: number;
  lastAuditAt: string | null;
} {
  let verifiedCount = 0;
  let aiGuessCount = 0;
  let officialCount = 0;
  for (const f of facts) {
    if (f.tier === "VERIFIED" || f.tier === "CONFIRMED") verifiedCount++;
    else if (f.tier === "AI_GUESS") aiGuessCount++;
    else if (f.tier === "OFFICIAL") officialCount++;
  }
  return { verifiedCount, aiGuessCount, officialCount, lastAuditAt };
}
