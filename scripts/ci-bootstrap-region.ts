/**
 * CI / Lighthouse helper — set Eindhoven bbox so db:seed can load the fixture.
 */
import { PrismaClient } from "@prisma/client";

const BBOX = "51.39,5.42,51.49,5.52";

const prisma = new PrismaClient();

async function main() {
  await prisma.nodeSettings.upsert({
    where: { id: "default" },
    update: {
      bbox: BBOX,
      region: "Eindhoven",
      presetId: "eindhoven",
      configuredAt: new Date(),
    },
    create: {
      id: "default",
      bbox: BBOX,
      region: "Eindhoven",
      presetId: "eindhoven",
      configuredAt: new Date(),
    },
  });
  console.log(`✓ Region bootstrapped for CI (${BBOX})`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
