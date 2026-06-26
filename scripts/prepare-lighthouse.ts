/**
 * Provisions a CI admin account and writes .lighthouse-secrets.json for Lighthouse.
 * Run after the node is up (pnpm build + next start on :3000 and :3001).
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { writeFileSync } from "fs";
import { join } from "path";

const NODE_URL = process.env.NODE_URL ?? "http://localhost:3000";
const USERNAME = process.env.LHCI_USERNAME ?? "lhci-admin";
const PASSWORD = process.env.LHCI_PASSWORD ?? "lighthouse-ci-9";
const BBOX = "51.39,5.42,51.49,5.52";

async function ensureLhciAdmin(prisma: PrismaClient) {
  const passwordHash = await hash(PASSWORD, 12);
  await prisma.user.upsert({
    where: { username: USERNAME },
    update: { passwordHash, role: "ADMIN" },
    create: { username: USERNAME, passwordHash, role: "ADMIN" },
  });
}

async function ensureRegion(prisma: PrismaClient) {
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
}

async function getToken(): Promise<string> {
  const loginRes = await fetch(`${NODE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });

  if (!loginRes.ok) {
    const err = await loginRes.text();
    throw new Error(`Lighthouse auth failed (${loginRes.status}): ${err}`);
  }

  const data = (await loginRes.json()) as { token: string };
  return data.token;
}

async function main() {
  const prisma = new PrismaClient();
  await ensureRegion(prisma);
  await ensureLhciAdmin(prisma);

  const token = await getToken();

  const property = await prisma.property.findFirst({
    where: { facts: { some: {} } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  await prisma.$disconnect();

  if (!property) {
    console.warn("⚠️  No properties with facts — run pnpm node:region --preset eindhoven && pnpm db:seed");
  } else {
    console.log(`Lighthouse audit target: ${property.name} (${property.id})`);
  }

  const out = {
    token,
    propertyId: property?.id ?? "unknown",
  };

  writeFileSync(join(process.cwd(), ".lighthouse-secrets.json"), JSON.stringify(out, null, 2));
  console.log("Wrote .lighthouse-secrets.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
