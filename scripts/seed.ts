/**
 * scripts/seed.ts
 *
 * Seeds the database with sample properties and OFFICIAL-tier accessibility facts.
 *
 * Usage:
 *   pnpm db:seed
 *
 * Requires AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET in .env, OR
 * falls back to bundled static sample data if credentials are absent.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Static sample data (used when Amadeus credentials are absent)
// ---------------------------------------------------------------------------
const SAMPLE_PROPERTIES = [
  {
    amadeusId: "HTVIENNA1",
    name: "Grand Hotel Vienna",
    location: "Kärntner Ring 9, 1010 Vienna, Austria",
    facts: [
      { fieldName: "door_width_cm", value: "90" },
      { fieldName: "ramp_present", value: "yes" },
      { fieldName: "elevator_present", value: "yes" },
      { fieldName: "elevator_floor_count", value: "8" },
      { fieldName: "accessible_bathroom", value: "yes" },
      { fieldName: "step_free_entrance", value: "yes" },
    ],
  },
  {
    amadeusId: "HTBARCELONA1",
    name: "Hotel Arts Barcelona",
    location: "Carrer de la Marina 19-21, 08005 Barcelona, Spain",
    facts: [
      { fieldName: "door_width_cm", value: "80" },
      { fieldName: "ramp_present", value: "yes" },
      { fieldName: "elevator_present", value: "yes" },
      { fieldName: "elevator_floor_count", value: "12" },
      { fieldName: "hearing_loop", value: "no" },
      { fieldName: "parking_accessible", value: "yes" },
    ],
  },
  {
    amadeusId: "HTAMSTERDAM1",
    name: "Pulitzer Amsterdam",
    location: "Prinsengracht 315-331, 1016 GZ Amsterdam, Netherlands",
    facts: [
      { fieldName: "door_width_cm", value: "75" },
      { fieldName: "ramp_present", value: "no" },
      { fieldName: "elevator_present", value: "yes" },
      { fieldName: "step_free_entrance", value: "no" },
      { fieldName: "notes", value: "Historic canal house — some rooms have step access." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Amadeus token fetch (optional)
// ---------------------------------------------------------------------------
async function getAmadeusToken(): Promise<string | null> {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    console.warn("⚠️  Amadeus auth failed — falling back to static data.");
    return null;
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Populate from Amadeus Hotel Search (test environment)
// ---------------------------------------------------------------------------
async function fetchAmadeusHotels(
  token: string,
  cityCode = "VIE"
): Promise<typeof SAMPLE_PROPERTIES> {
  const res = await fetch(
    `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?cityCode=${cityCode}&ratings=4,5&hotelSource=ALL`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    console.warn(`⚠️  Amadeus hotel search failed (${res.status}) — using static data.`);
    return SAMPLE_PROPERTIES;
  }
  const data = await res.json() as {
    data: Array<{
      hotelId: string;
      name: string;
      address: { lines: string[]; cityName: string; countryCode: string };
    }>;
  };

  return data.data.slice(0, 5).map((h) => ({
    amadeusId: h.hotelId,
    name: h.name,
    location: [
      ...(h.address.lines ?? []),
      h.address.cityName,
      h.address.countryCode,
    ]
      .filter(Boolean)
      .join(", "),
    // Amadeus doesn't provide accessibility details — mark as OFFICIAL (baseline)
    facts: [
      { fieldName: "notes", value: "Amadeus baseline — accessibility details unverified." },
    ],
  }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("🌱 WikiTraveler seed starting…");

  const token = await getAmadeusToken();
  const properties = token
    ? await fetchAmadeusHotels(token)
    : SAMPLE_PROPERTIES;

  const NODE_ID = process.env.NODE_ID ?? "seed-script";

  for (const prop of properties) {
    const property = await prisma.property.upsert({
      where: { amadeusId: prop.amadeusId },
      update: { name: prop.name, location: prop.location },
      create: { amadeusId: prop.amadeusId, name: prop.name, location: prop.location },
    });

    for (const fact of prop.facts) {
      await prisma.accessibilityFact.upsert({
        where: {
          propertyId_fieldName_sourceNodeId: {
            propertyId: property.id,
            fieldName: fact.fieldName,
            sourceNodeId: NODE_ID,
          },
        },
        update: { value: fact.value },
        create: {
          propertyId: property.id,
          fieldName: fact.fieldName,
          value: fact.value,
          tier: "OFFICIAL",
          sourceNodeId: NODE_ID,
        },
      });
    }
    console.log(`  ✅ ${property.name} (${prop.facts.length} facts)`);
  }

  console.log(`\n✨ Seeded ${properties.length} properties.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
