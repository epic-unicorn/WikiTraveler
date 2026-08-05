# Public peers directory

Voluntary list of **public** WikiTraveler nodes that new operators and **hub Access** deployments can use as `BOOTSTRAP_PEERS` seeds.

**Data file:** [public-peers.json](./public-peers.json)

## Opt in

1. Run a publicly reachable node with HTTPS and a current release ([OPERATORS.md](./OPERATORS.md)).
2. Confirm `/api/health` and `/api/nodeinfo` respond without auth.
3. Allow trusted hub origins (`CLIENT_ORIGINS` / `CORS_ORIGINS`) so travelers on the canonical Access can reach your region.
4. Open a PR adding an entry to `public-peers.json`:

```json
{
  "nodeId": "your-node-id",
  "url": "https://node.example.org",
  "region": "EU-NL",
  "accessUrl": "https://access.wikitraveler.org",
  "notes": "Eindhoven sample region — accessUrl is directory hint only, not auto CORS trust",
  "operatorContact": "ops@example.org"
}
```

5. Maintainers merge after a quick reachability check.

## Opt out

PR removing your entry, or open an **Operator help** issue.

## How clients use this

- **Operators:** copy one or more `url` values into `BOOTSTRAP_PEERS` (comma-separated).
- **Hub Access:** set `NEXT_PUBLIC_NODE_API_URL` to a default home node; GPS resolve still uses that node’s `/api/peers/resolve` once peers are known. Prefer linking travelers to `https://access.wikitraveler.org`.
- **`accessUrl` in this file** is an operator/directory hint — nodes must still configure `CLIENT_ORIGINS` / `CORS_ORIGINS` explicitly (never auto-trust gossip alone).
- **This file is not a live registry** — gossip remains the organic discovery layer after bootstrap.

## Cross-node accounts

Users register on **one** home node. With RS256 keys configured, hub Access can call peer nodes using the same JWT (peers fetch `/.well-known/pubkey` from the home node). See [FEDERATED-AUTH.md](./FEDERATED-AUTH.md).
