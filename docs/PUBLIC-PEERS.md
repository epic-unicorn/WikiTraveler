# Public peers directory

Voluntary list of **public** WikiTraveler nodes that new operators and Access deployments can use as `BOOTSTRAP_PEERS` seeds.

**Data file:** [public-peers.json](./public-peers.json)

## Opt in

1. Run a publicly reachable node with HTTPS and a current release ([OPERATORS.md](./OPERATORS.md)).
2. Confirm `/api/health` and `/api/nodeinfo` respond without auth.
3. Open a PR adding an entry to `public-peers.json`:

```json
{
  "nodeId": "your-node-id",
  "url": "https://node.example.org",
  "region": "EU-NL",
  "accessUrl": "https://access.example.org",
  "notes": "Eindhoven sample region",
  "operatorContact": "ops@example.org"
}
```

4. Maintainers merge after a quick reachability check.

## Opt out

PR removing your entry, or open an **Operator help** issue.

## How clients use this

- **Operators:** copy one or more `url` values into `BOOTSTRAP_PEERS` (comma-separated).
- **Access:** set `NEXT_PUBLIC_NODE_API_URL` to your home node; GPS resolve still uses that node’s `/api/peers/resolve` once peers are known.
- **This file is not a live registry** — gossip remains the organic discovery layer after bootstrap.

## Cross-node accounts

Users register on **one** home node. With RS256 keys configured, Access can call peer nodes using the same JWT (peers fetch `/.well-known/pubkey` from the home node). See [FEDERATED-AUTH.md](./FEDERATED-AUTH.md).
