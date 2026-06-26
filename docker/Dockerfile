# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/ui/package.json ./packages/ui/
COPY packages/ai-agent/package.json ./packages/ai-agent/
COPY packages/i18n/package.json ./packages/i18n/
COPY apps/node/package.json ./apps/node/
COPY prisma/schema.prisma ./prisma/

RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/ai-agent/node_modules ./packages/ai-agent/node_modules
COPY --from=deps /app/packages/i18n/node_modules ./packages/i18n/node_modules
COPY --from=deps /app/apps/node/node_modules ./apps/node/node_modules

COPY . .

# Generate Prisma client (debian-openssl-3.0.x), build shared packages, then the node app
RUN pnpm exec prisma generate --schema=/app/prisma/schema.prisma
RUN pnpm --filter @wikitraveler/core build
RUN pnpm --filter @wikitraveler/i18n build
RUN pnpm --filter @wikitraveler/ui build
RUN pnpm --filter @wikitraveler/ai-agent build
RUN pnpm --filter @wikitraveler/node build

# Stage Prisma client package + query engine to fixed paths (pnpm store path varies)
RUN PRISMA_CLIENT="$(find /app/node_modules/.pnpm -path '*/.prisma/client' -type d | head -1)" \
  && PRISMA_PKG="$(find /app/node_modules/.pnpm -type d -path '*/node_modules/@prisma/client' | head -1)" \
  && test -n "$PRISMA_CLIENT" && test -n "$PRISMA_PKG" \
  && mkdir -p /app/prisma-engine/client /app/prisma-engine/npm-client \
  && cp -r "$PRISMA_CLIENT"/. /app/prisma-engine/client/ \
  && cp -r "$PRISMA_PKG"/. /app/prisma-engine/npm-client/

# Bundle OSM PBF import CLI for the production image (no pnpm in runner)
RUN npx --yes esbuild@0.24.2 scripts/node-ingest-pbf.ts \
  --bundle --platform=node --target=node20 --format=cjs \
  --external:@prisma/client \
  --alias:@/lib=./apps/node/lib \
  --outfile=/app/bin/osm-import-pbf.cjs

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates osmium-tool \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/node/.next/standalone ./
COPY --from=builder /app/apps/node/.next/static ./apps/node/.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma-engine/npm-client ./node_modules/@prisma/client
COPY --from=builder /app/prisma-engine/client ./node_modules/.prisma/client
COPY --from=builder /app/bin/osm-import-pbf.cjs ./bin/osm-import-pbf.cjs

RUN npm install -g prisma@5.22.0

COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/osm-import-pbf.sh /usr/local/bin/osm-import-pbf
RUN chmod +x /entrypoint.sh /usr/local/bin/osm-import-pbf

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/entrypoint.sh"]
