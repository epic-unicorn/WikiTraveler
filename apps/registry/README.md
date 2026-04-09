# WikiTraveler Registry

Node discovery and registration service for the WikiTraveler mesh network.

## Overview

The registry is a centralized service that allows nodes to:
1. **Register** their public URL and basic info
2. **Discover** other active nodes in the network
3. **Get peer recommendations** based on region

## Setup

```bash
pnpm install
```

## Environment

The registry shares the root `.env` file. Minimum required:

```env
DATABASE_URL=postgresql://wikitraveler:wikitraveler@localhost:5432/wikitraveler
```

Copy `.env.example` from the repo root and fill in your values.

## Database

Run migrations from the registry app directory:

```bash
cd apps/registry
npx prisma migrate dev --name init
```

## Running

```bash
pnpm dev:registry            # development (port 3002)
pnpm -C apps/registry build  # production build
pnpm -C apps/registry start  # production server (port 3002)
```

## API

### POST /v1/nodes/register

Register a node or send a heartbeat.

```bash
curl -X POST http://localhost:3002/api/v1/nodes/register \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://node-a.wikitraveler.org",
    "nodeId": "node-a",
    "region": "amsterdam"
  }'
```

**Response:**
```json
{ "ok": true, "nodeId": "node-a", "url": "https://node-a.wikitraveler.org" }
```

### GET /v1/nodes

List active nodes in the registry.

```bash
# All nodes
curl http://localhost:3002/api/v1/nodes

# Nodes in a specific region
curl "http://localhost:3002/api/v1/nodes?region=amsterdam"

# Limit results
curl "http://localhost:3002/api/v1/nodes?limit=20"
```

**Response:**
```json
{
  "nodes": [
    {
      "nodeId": "node-a",
      "url": "https://node-a.wikitraveler.org",
      "region": "amsterdam",
      "lastHeartbeat": "2026-04-09T12:34:56.789Z"
    }
  ]
}
```

### GET /v1/nodes/:nodeId/peers

Get peer recommendations for a node.

```bash
# Peers anywhere in the network
curl http://localhost:3002/api/v1/nodes/node-a/peers

# Prefer peers in the same region
curl "http://localhost:3002/api/v1/nodes/node-a/peers?sameRegion=true"
```

**Response:**
```json
{
  "peers": [
    {
      "nodeId": "node-b",
      "url": "https://node-b.wikitraveler.org",
      "region": "amsterdam"
    }
  ]
}
```

## Node Integration

Nodes auto-register with the registry on startup. Set `REGISTRY_URL` in the node's `.env` and that's it:

```env
REGISTRY_URL=http://localhost:3002
```

On boot, the node calls `POST /api/v1/nodes/register` with its `NODE_ID`, `NODE_URL`, and `NODE_REGION`. If `REGISTRY_URL` is unset, registration is silently skipped.

To keep the registration alive, add a heartbeat cron that hits the same endpoint periodically (the registry uses lastHeartbeat to determine active nodes):

```bash
# Example: heartbeat every 20 hours
curl -X POST http://localhost:3002/api/v1/nodes/register \
  -H "Content-Type: application/json" \
  -d '{"url":"https://node-a.wikitraveler.org","nodeId":"node-a","region":"amsterdam"}'
```

### 3. Periodically fetch and merge peer recommendations:

```typescript
// GET /api/cron/discovery
// Fetches /v1/nodes?region=... and upserts into your local NodePeer table
```
