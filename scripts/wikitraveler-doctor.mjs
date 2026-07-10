#!/usr/bin/env node
/**
 * WikiTraveler operator health check — version, migrations, peers, keys.
 *
 * Usage:
 *   pnpm doctor
 *   NODE_URL=https://node.example.com pnpm doctor
 */
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const NODE_URL = (process.env.NODE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const NODE_ENV = process.env.NODE_ENV ?? "development";
const isProduction = NODE_ENV === "production";

let errors = 0;
let warnings = 0;

function ok(msg) {
  console.log(`✓ ${msg}`);
}

function warn(msg) {
  warnings += 1;
  console.log(`⚠ ${msg}`);
}

function fail(msg) {
  errors += 1;
  console.log(`✗ ${msg}`);
}

function readJson(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
}

function checkVersions() {
  console.log("Version");
  const rootPkg = readJson("package.json");
  const versions = readJson("versions.json");
  const manifest = readJson("releases/manifest.json");

  ok(`Workspace release ${rootPkg.version}`);
  if (versions.release !== rootPkg.version) {
    warn(`versions.json release (${versions.release}) differs from package.json (${rootPkg.version})`);
  } else {
    ok("versions.json aligned");
  }
  if (manifest.latest !== rootPkg.version) {
    warn(`releases/manifest.json latest (${manifest.latest}) differs from package.json (${rootPkg.version})`);
  } else {
    ok("releases/manifest.json aligned");
  }
  console.log("");
}

function checkMigrations() {
  console.log("Database migrations");
  try {
    const out = execSync("pnpm exec prisma migrate status", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (/Following migration have not yet been applied/i.test(out)) {
      fail("Pending Prisma migrations — run pnpm db:deploy");
      console.log(out.trim());
    } else if (/Database schema is up to date/i.test(out)) {
      ok("Prisma schema up to date");
    } else {
      ok("Prisma migrate status completed");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/P1001|P1017|ECONNREFUSED|Can't reach database/i.test(message)) {
      warn("Could not reach database for migrate status (set DATABASE_URL?)");
    } else {
      fail("Prisma migrate status failed");
      console.log(message);
    }
  }
  console.log("");
}

function checkKeys() {
  console.log("Node keys");
  const pub = process.env.NODE_PUBLIC_KEY?.trim();
  const priv = process.env.NODE_PRIVATE_KEY?.trim();

  if (pub && priv) {
    ok("RS256 keypair configured");
  } else if (isProduction) {
    fail("NODE_PUBLIC_KEY and NODE_PRIVATE_KEY required in production");
  } else {
    warn("NODE_PUBLIC_KEY / NODE_PRIVATE_KEY not set (dev HS256 fallback)");
  }
  console.log("");
}

async function fetchJson(path) {
  const res = await fetch(`${NODE_URL}${path}`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

async function checkNodeReachability() {
  console.log(`Node (${NODE_URL})`);
  try {
    const health = await fetchJson("/api/health");
    ok(`Health OK — v${health.version}, nodeId ${health.nodeId}, ${health.peerCount} active peers`);
  } catch (err) {
    fail(`Could not reach ${NODE_URL}/api/health`);
    console.log(`  ${err instanceof Error ? err.message : err}`);
    console.log("");
    return;
  }

  try {
    const info = await fetchJson("/api/nodeinfo");
    if (!info.publicKeyPem) {
      if (isProduction) fail("nodeinfo missing publicKeyPem");
      else warn("nodeinfo missing publicKeyPem");
    } else {
      ok("nodeinfo exposes publicKeyPem");
    }
    ok(`Gossip protocol ${info.gossipProtocol}, export schema ${info.exportSchema}`);
  } catch (err) {
    warn(`Could not fetch /api/nodeinfo — ${err instanceof Error ? err.message : err}`);
  }

  const bootstrap = (process.env.BOOTSTRAP_PEERS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);

  if (bootstrap.length === 0) {
    ok("No BOOTSTRAP_PEERS configured (optional)");
  } else {
    for (const peerUrl of bootstrap) {
      try {
        const res = await fetch(`${peerUrl}/api/nodeinfo`, { signal: AbortSignal.timeout(8_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const peer = await res.json();
        ok(`Bootstrap peer reachable — ${peer.nodeId ?? peerUrl} v${peer.version ?? "?"}`);
      } catch (err) {
        warn(`Bootstrap peer unreachable — ${peerUrl} (${err instanceof Error ? err.message : err})`);
      }
    }
  }
  console.log("");
}

async function main() {
  console.log("WikiTraveler doctor\n");
  checkVersions();
  checkMigrations();
  checkKeys();
  await checkNodeReachability();

  console.log(`Summary: ${errors} error(s), ${warnings} warning(s)`);
  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
