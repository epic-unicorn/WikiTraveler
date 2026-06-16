/**
 * Provisions a CI admin account and writes .lighthouse-secrets.json for Lighthouse.
 * Run after the node is up (pnpm db:setup + next start).
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { join } from "path";

const NODE_URL = process.env.NODE_URL ?? "http://localhost:3000";
const USERNAME = process.env.LHCI_USERNAME ?? "lhci-admin";
const PASSWORD = process.env.LHCI_PASSWORD ?? "lighthouse-ci-9";

async function getToken() {
  const setupRes = await fetch(`${NODE_URL}/api/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });

  if (setupRes.ok) {
    const data = await setupRes.json();
    return data.token;
  }

  const loginRes = await fetch(`${NODE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });

  if (!loginRes.ok) {
    const err = await loginRes.text();
    throw new Error(`Lighthouse auth failed (${loginRes.status}): ${err}`);
  }

  const data = await loginRes.json();
  return data.token;
}

async function main() {
  const token = await getToken();

  const prisma = new PrismaClient();
  const property = await prisma.property.findFirst({
    where: { facts: { some: {} } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  await prisma.$disconnect();

  if (!property) {
    console.warn("⚠️  No seeded properties with facts — audit URL may 404.");
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
