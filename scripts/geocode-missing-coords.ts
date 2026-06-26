/**
 * Geocode properties that have no lat/lon so they appear on the map.
 *
 * Usage:
 *   pnpm geocode:missing
 *   pnpm geocode:missing --name "Test Hotel"
 */

import { PrismaClient } from "@prisma/client";
import { forwardGeocode } from "../apps/node/lib/nominatim";

const prisma = new PrismaClient();

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
    console.log(
      nameFilter
        ? `No properties without coordinates matching "${nameFilter}".`
        : "No properties without coordinates."
    );
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
