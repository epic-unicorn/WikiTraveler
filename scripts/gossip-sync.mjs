/**
 * Trigger gossip pull on both gossip-lab nodes.
 *
 * Usage: pnpm gossip:sync
 */

const NODES = [
  process.env.NODE_A_URL ?? "http://localhost:3000",
  process.env.NODE_B_URL ?? "http://localhost:3010",
];

async function syncNode(baseUrl) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/cron/gossip`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${url} → ${res.status}: ${data.message ?? JSON.stringify(data)}`);
  }
  console.log(`✓ ${baseUrl}`);
  for (const r of data.results ?? []) {
    const status = r.ok ? `ingested ${r.ingested ?? 0}` : r.error;
    console.log(`    ${r.url}: ${status}`);
  }
}

async function main() {
  console.log("Running gossip sync on both nodes…");
  for (const node of NODES) {
    await syncNode(node);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
