/**
 * scripts/seed.ts
 *
 * Seeds the database with sample properties and OFFICIAL-tier accessibility facts.
 *
 * Properties are identified by their Wikidata Q-identifier (canonicalId).
 *
 * Usage:
 *   pnpm db:seed
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Sample properties identified by their Wikidata Q-identifier
// ---------------------------------------------------------------------------
const SAMPLE_PROPERTIES = [
  {
    // https://www.wikidata.org/wiki/Q610297 — Grand Hotel Wien
    canonicalId: "Q610297",
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
    // https://www.wikidata.org/wiki/Q5897396 — Hotel Arts Barcelona
    canonicalId: "Q5897396",
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
    // https://www.wikidata.org/wiki/Q17371014 — Pulitzer Amsterdam
    canonicalId: "Q17371014",
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
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("🌱 WikiTraveler seed starting…");

  const NODE_ID = process.env.NODE_ID ?? "seed-script";

  for (const prop of SAMPLE_PROPERTIES) {
    const property = await prisma.property.upsert({
      where: { canonicalId: prop.canonicalId },
      update: { name: prop.name, location: prop.location },
      create: { canonicalId: prop.canonicalId, name: prop.name, location: prop.location },
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
          sourceType: "WIKIDATA",
          sourceNodeId: NODE_ID,
        },
      });
    }
    console.log(`  ✅ ${property.name} (${prop.facts.length} facts)`);
  }

  console.log(`\n✨ Seeded ${SAMPLE_PROPERTIES.length} properties.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
