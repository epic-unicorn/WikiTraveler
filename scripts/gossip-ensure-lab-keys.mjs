/**
 * Ensure gossip-lab RSA keypairs exist (dev/CI only).
 *
 * node-a / node-b are usually committed; node-c is generated locally/CI so
 * private keys are not introduced in PRs (GitGuardian).
 *
 * Usage: pnpm gossip:ensure-lab-keys
 */

import { spawnSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LAB = join(ROOT, "docker", "gossip-lab");

const NODES = (process.env.GOSSIP_LAB_KEY_NODES ?? "node-a,node-b,node-c")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: LAB, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed`);
  }
}

function ensurePair(nodeId) {
  const priv = join(LAB, `${nodeId}.private.pem`);
  const pub = join(LAB, `${nodeId}.public.pem`);
  if (existsSync(priv) && existsSync(pub)) {
    console.log(`✓ ${nodeId} keys present`);
    return;
  }
  console.log(`Generating ${nodeId} lab keys…`);
  run("openssl", ["genrsa", "-out", `${nodeId}.private.pem`, "2048"]);
  run("openssl", ["rsa", "-in", `${nodeId}.private.pem`, "-pubout", "-out", `${nodeId}.public.pem`]);
  console.log(`✓ ${nodeId} keys created`);
}

mkdirSync(LAB, { recursive: true });
for (const nodeId of NODES) {
  ensurePair(nodeId);
}
console.log("\n✓ Gossip lab keys ready");
