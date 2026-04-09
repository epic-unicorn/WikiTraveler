import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getNodes() {
  try {
    return await prisma.registryNode.findMany({
      where: { isActive: true },
      select: { nodeId: true, url: true, region: true, lastHeartbeat: true },
      orderBy: { lastHeartbeat: "desc" },
    });
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const nodes = await getNodes();

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 700, margin: "40px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>WikiTraveler Node Registry</h1>
      <p style={{ color: "#6b7280", marginBottom: 32 }}>Node discovery and registration service for the WikiTraveler mesh.</p>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Registered Nodes {nodes !== null && <span style={{ fontSize: 14, fontWeight: 400, color: "#6b7280" }}>({nodes.length})</span>}</h2>

      {nodes === null ? (
        <p style={{ color: "#ef4444" }}>Database unavailable — check DATABASE_URL.</p>
      ) : nodes.length === 0 ? (
        <p style={{ color: "#9ca3af" }}>No nodes registered yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", border: "1px solid #e5e7eb" }}>Node ID</th>
              <th style={{ textAlign: "left", padding: "8px 12px", border: "1px solid #e5e7eb" }}>URL</th>
              <th style={{ textAlign: "left", padding: "8px 12px", border: "1px solid #e5e7eb" }}>Region</th>
              <th style={{ textAlign: "left", padding: "8px 12px", border: "1px solid #e5e7eb" }}>Last Heartbeat</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr key={n.nodeId}>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontFamily: "monospace" }}>{n.nodeId}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>
                  <a href={n.url} target="_blank" rel="noreferrer" style={{ color: "#1e3a5f" }}>{n.url}</a>
                </td>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", color: "#6b7280" }}>{n.region ?? "—"}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", color: "#6b7280" }}>
                  {new Date(n.lastHeartbeat).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 18, marginTop: 40, marginBottom: 12 }}>API</h2>
      <ul style={{ lineHeight: 2 }}>
        <li><code>POST /api/v1/nodes/register</code> — Register or heartbeat a node</li>
        <li><code>GET /api/v1/nodes</code> — List active nodes (optional: ?region=amsterdam)</li>
        <li><code>GET /api/v1/nodes/:nodeId/peers</code> — Get peer recommendations</li>
      </ul>

      <h3 style={{ marginTop: 24 }}>Register a node</h3>
      <pre style={{ background: "#f3f4f6", padding: 16, borderRadius: 8, fontSize: 13, overflowX: "auto" }}>{`curl -X POST http://localhost:3002/api/v1/nodes/register \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://node-a.example.org","nodeId":"node-a","region":"amsterdam"}'`}</pre>
    </main>
  );
}
