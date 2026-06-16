/**
 * Link gossip-lab peers mutually (reactivates inactive peers).
 *
 * Uses Docker-internal URLs on port 3000 (both containers listen on 3000;
 * host maps Node B as localhost:3010 → container:3000).
 *
 * Usage: pnpm gossip:link-peers
 */

const NODE_A = (process.env.NODE_A_URL ?? "http://localhost:3000").replace(/\/$/, "");
const NODE_B = (process.env.NODE_B_URL ?? "http://localhost:3010").replace(/\/$/, "");

/** Server-side reachability inside the Docker network (always port 3000). */
const PEER_FOR_A = (process.env.NODE_B_PEER_URL ?? "http://node-b:3000").replace(/\/$/, "");
const PEER_FOR_B = (process.env.NODE_A_PEER_URL ?? "http://node-a:3000").replace(/\/$/, "");

const RETRIES = Number(process.env.GOSSIP_LINK_RETRIES ?? 8);
const RETRY_MS = Number(process.env.GOSSIP_LINK_RETRY_MS ?? 3000);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function linkOnce(selfUrl, peerUrl) {
  const res = await fetch(`${selfUrl}/api/dev/link-peers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ peerUrl }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    return { ok: false, error: `${selfUrl} → ${peerUrl}: ${data.message ?? res.status}` };
  }
  return { ok: true, nodeId: data.nodeId ?? peerUrl };
}

async function linkWithRetry(label, selfUrl, peerUrl) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const result = await linkOnce(selfUrl, peerUrl);
    if (result.ok) {
      console.log(`✓ ${label} linked ${result.nodeId}`);
      return result;
    }
    if (attempt < RETRIES) {
      console.log(`  ${label}: ${result.error} — retry ${attempt}/${RETRIES} in ${RETRY_MS / 1000}s…`);
      await sleep(RETRY_MS);
    } else {
      console.error(`✗ ${result.error}`);
      return result;
    }
  }
  return { ok: false, error: "exhausted retries" };
}

async function main() {
  console.log("Linking gossip lab peers…");
  console.log(`  A registers B at ${PEER_FOR_A}`);
  console.log(`  B registers A at ${PEER_FOR_B}`);

  const [aResult, bResult] = await Promise.all([
    linkWithRetry("Node A", NODE_A, PEER_FOR_A),
    linkWithRetry("Node B", NODE_B, PEER_FOR_B),
  ]);

  if (!aResult.ok || !bResult.ok) {
    process.exit(1);
  }

  console.log("Done. Run pnpm gossip:check to verify.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
