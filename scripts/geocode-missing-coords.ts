/**
 * Geocode properties that have no lat/lon so they appear on the map.
 *
 * Usage:
 *   npx tsx scripts/geocode-missing-coords.ts
 *   npx tsx scripts/geocode-missing-coords.ts --name "Test Hotel"
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "WikiTraveler/0.2 (geocode-missing-coords)";

let lastRequestAt = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const wait = Math.max(0, 1100 - (Date.now() - lastRequestAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
}

async function forwardGeocode(query: string): Promise<{ lat: number; lon: number } | null> {
  const attempts = [
    query,
    query.includes("Nederland") || query.includes("Netherlands") ? "" : `${query}, Netherlands`,
  ].filter(Boolean);

  for (const attempt of attempts) {
    const url = new URL(NOMINATIM_SEARCH);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("q", attempt);

    const res = await rateLimitedFetch(url.toString());
    if (!res.ok) continue;

    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const hit = data[0];
    if (!hit?.lat || !hit?.lon) continue;

    const lat = Number(hit.lat);
    const lon = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    return { lat, lon };
  }

  return null;
}

function parseNameArg(): string | null {
  const idx = process.argv.indexOf("--name");
  if (idx === -1) return null;
  return process.argv[idx + 1]?.trim() || null;
}

async function main() {
  const nameFilter = parseNameArg();

  const properties = await prisma.property.findMany({
    where: {
      OR: [{ lat: null }, { lon: null }],
      ...(nameFilter ? { name: { contains: nameFilter, mode: "insensitive" } } : {}),
    },
    select: { id: true, name: true, location: true, lat: true, lon: true },
    orderBy: { name: "asc" },
  });

  if (properties.length === 0) {
    console.log(nameFilter ? `No properties without coordinates matching "${nameFilter}".` : "No properties without coordinates.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${properties.length} propert${properties.length === 1 ? "y" : "ies"} to geocode.`);

  let updated = 0;
  let failed = 0;

  for (const property of properties) {
    const query = property.location.trim() || property.name.trim();
    const coords = await forwardGeocode(query);
    if (!coords) {
      console.log(`✗ ${property.name} — could not geocode "${query}"`);
      failed++;
      continue;
    }

    await prisma.property.update({
      where: { id: property.id },
      data: { lat: coords.lat, lon: coords.lon },
    });
    console.log(`✓ ${property.name} → ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`);
    updated++;
  }

  console.log(`Done: ${updated} updated, ${failed} failed.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
