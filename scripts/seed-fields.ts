/**
 * Seed global FieldDefinition rows from the standard catalogue.
 * Run after migrations: tsx scripts/seed-fields.ts
 */

import { PrismaClient, FieldScope, ValueType } from "@prisma/client";

const prisma = new PrismaClient();

type FieldSeed = {
  fieldName: string;
  scope: FieldScope;
  valueType: ValueType;
  enumValues?: string[];
  labels: Record<string, string>;
  unit?: string;
  searchFilter?: boolean;
};

const STANDARD_FIELDS: FieldSeed[] = [
  { fieldName: "door_width_cm", scope: "PROPERTY", valueType: "NUMBER", labels: { en: "Door width", nl: "Deurbreedte", de: "Türbreite", fr: "Largeur de porte" }, unit: "cm" },
  { fieldName: "ramp_present", scope: "PROPERTY", valueType: "BOOLEAN", labels: { en: "Ramp present", nl: "Oprijplaat aanwezig", de: "Rampe vorhanden", fr: "Rampe présente" }, searchFilter: true },
  { fieldName: "elevator_present", scope: "PROPERTY", valueType: "BOOLEAN", labels: { en: "Elevator", nl: "Lift", de: "Aufzug", fr: "Ascenseur" }, searchFilter: true },
  { fieldName: "elevator_floor_count", scope: "PROPERTY", valueType: "NUMBER", labels: { en: "Elevator floors", nl: "Aantal liftverdiepingen", de: "Aufzugsetagen", fr: "Étages desservis" } },
  { fieldName: "quiet_hours_start", scope: "PROPERTY", valueType: "TIME", labels: { en: "Quiet hours start", nl: "Stilte-uren begin", de: "Ruhezeiten Beginn", fr: "Heures calmes début" } },
  { fieldName: "quiet_hours_end", scope: "PROPERTY", valueType: "TIME", labels: { en: "Quiet hours end", nl: "Stilte-uren einde", de: "Ruhezeiten Ende", fr: "Heures calmes fin" } },
  { fieldName: "accessible_bathroom", scope: "PROPERTY", valueType: "BOOLEAN", labels: { en: "Accessible bathroom", nl: "Toegankelijke badkamer", de: "Barrierefreies Bad", fr: "Salle de bain accessible" }, searchFilter: true },
  { fieldName: "hearing_loop", scope: "PROPERTY", valueType: "BOOLEAN", labels: { en: "Hearing loop", nl: "Hoortlus", de: "Induktionsschleife", fr: "Boucle magnétique" }, searchFilter: true },
  { fieldName: "braille_signage", scope: "PROPERTY", valueType: "BOOLEAN", labels: { en: "Braille signage", nl: "Braille bewegwijzering", de: "Braille-Beschilderung", fr: "Signalétique braille" }, searchFilter: true },
  { fieldName: "step_free_entrance", scope: "PROPERTY", valueType: "BOOLEAN", labels: { en: "Step-free entrance", nl: "Drempelloze ingang", de: "Stufenfreier Eingang", fr: "Entrée sans marche" }, searchFilter: true },
  { fieldName: "parking_accessible", scope: "PROPERTY", valueType: "BOOLEAN", labels: { en: "Accessible parking", nl: "Toegankelijk parkeren", de: "Barrierefreies Parken", fr: "Parking accessible" }, searchFilter: true },
  { fieldName: "notes", scope: "PROPERTY", valueType: "TEXT", labels: { en: "Notes", nl: "Notities", de: "Notizen", fr: "Notes" } },
  { fieldName: "tactile_paving", scope: "PROPERTY", valueType: "BOOLEAN", labels: { en: "Tactile paving", nl: "Geleidelijnen", de: "Taktile Leitsysteme", fr: "Bandes podotactiles" }, searchFilter: true },
  { fieldName: "roll_in_shower", scope: "ROOM", valueType: "BOOLEAN", labels: { en: "Roll-in shower", nl: "Inloopdouche", de: "Ebenerdige Dusche", fr: "Douche à accès de plain-pied" } },
  { fieldName: "grab_bars_bathroom", scope: "ROOM", valueType: "BOOLEAN", labels: { en: "Grab bars in bathroom", nl: "Steunbeugels badkamer", de: "Haltegriffe im Bad", fr: "Barres d'appui salle de bain" } },
  { fieldName: "bed_height_cm", scope: "ROOM", valueType: "NUMBER", labels: { en: "Bed height", nl: "Bedhoogte", de: "Betthöhe", fr: "Hauteur du lit" }, unit: "cm" },
  { fieldName: "turning_circle_cm", scope: "ROOM", valueType: "NUMBER", labels: { en: "Turning circle", nl: "Draaicirkel", de: "Drehkreis", fr: "Cercle de rotation" }, unit: "cm" },
  { fieldName: "pool_lift", scope: "PROPERTY", valueType: "BOOLEAN", labels: { en: "Pool lift", nl: "Zwembadlift", de: "Poollift", fr: "Lève-personne piscine" } },
  { fieldName: "service_animal_policy", scope: "PROPERTY", valueType: "TEXT", labels: { en: "Service animal policy", nl: "Beleid hulphonden", de: "Assistenzhunde-Richtlinie", fr: "Politique animaux d'assistance" } },
  { fieldName: "room_types_available", scope: "PROPERTY", valueType: "ENUM", enumValues: ["double", "twin", "single", "accessible_king", "accessible_queen", "suite", "family"], labels: { en: "Room types available", nl: "Beschikbare kamertypes", de: "Verfügbare Zimmertypen", fr: "Types de chambres disponibles" } },
  { fieldName: "accessible_room_count", scope: "PROPERTY", valueType: "NUMBER", labels: { en: "Accessible rooms", nl: "Toegankelijke kamers", de: "Barrierefreie Zimmer", fr: "Chambres accessibles" }, searchFilter: true },
  { fieldName: "accessible_room_description", scope: "PROPERTY", valueType: "TEXT", labels: { en: "Accessible room description", nl: "Beschrijving toegankelijke kamer", de: "Beschreibung barrierefreies Zimmer", fr: "Description chambre accessible" } },
];

async function main() {
  console.log("🌱 Seeding field definitions…");
  for (const field of STANDARD_FIELDS) {
    await prisma.fieldDefinition.upsert({
      where: { fieldName: field.fieldName },
      update: {
        scope: field.scope,
        valueType: field.valueType,
        enumValues: field.enumValues ?? [],
        labels: field.labels,
        unit: field.unit ?? null,
        searchFilter: field.searchFilter ?? false,
        active: true,
      },
      create: {
        fieldName: field.fieldName,
        scope: field.scope,
        valueType: field.valueType,
        enumValues: field.enumValues ?? [],
        labels: field.labels,
        unit: field.unit ?? null,
        searchFilter: field.searchFilter ?? false,
        nodeId: null,
        active: true,
      },
    });
  }
  const count = await prisma.fieldDefinition.count();
  console.log(`✨ ${count} field definitions in registry.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
