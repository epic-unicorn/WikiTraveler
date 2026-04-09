export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 600, margin: "40px auto", padding: "0 20px" }}>
      <h1>WikiTraveler Node Registry</h1>
      <p>Service for node discovery and peer management.</p>
      
      <h2>API Endpoints</h2>
      <ul>
        <li><code>POST /v1/nodes/register</code> — Register or heartbeat a node</li>
        <li><code>GET /v1/nodes</code> — List active nodes (optional: ?region=amsterdam)</li>
        <li><code>GET /v1/nodes/:nodeId/peers</code> — Get peer recommendations</li>
      </ul>

      <h3>Example: Register a node</h3>
      <pre>{`curl -X POST http://localhost:3001/v1/nodes/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://node-a.wikitraveler.org",
    "nodeId": "node-a",
    "region": "amsterdam"
  }'`}</pre>

      <h3>Example: List active nodes</h3>
      <pre>{`curl http://localhost:3001/v1/nodes?region=amsterdam`}</pre>
    </main>
  );
}
