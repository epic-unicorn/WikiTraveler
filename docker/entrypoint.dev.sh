#!/bin/sh
set -e

# Gossip lab: load dev RSA keys from mounted PEM files
if [ -n "$GOSSIP_KEY_DIR" ] && [ -f "$GOSSIP_KEY_DIR/private.pem" ]; then
  export NODE_PRIVATE_KEY="$(cat "$GOSSIP_KEY_DIR/private.pem")"
  export NODE_PUBLIC_KEY="$(cat "$GOSSIP_KEY_DIR/public.pem")"
  echo "🔑 Loaded gossip lab keys from $GOSSIP_KEY_DIR"
fi

# Bind-mounted repo + empty node_modules volume hides image deps on first run
if [ ! -x node_modules/.bin/prisma ]; then
  echo "📦 Installing dependencies (first run or empty node_modules volume)..."
  pnpm install --frozen-lockfile
fi

echo "⏳ Running Prisma migrations..."
pnpm exec prisma migrate deploy --schema=/app/prisma/schema.prisma

echo "⚙️  Generating Prisma client..."
pnpm exec prisma generate --schema=/app/prisma/schema.prisma

echo "🔧 Building shared packages..."
pnpm --filter @wikitraveler/core build
pnpm --filter @wikitraveler/ui build

echo "🚀 Starting WikiTraveler node in development mode (port ${PORT:-3000})..."
exec pnpm --filter @wikitraveler/node exec next dev -p "${PORT:-3000}"
