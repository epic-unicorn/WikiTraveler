#!/bin/sh
set -e

echo "⏳ Running Prisma migrations..."
npx prisma migrate deploy --schema=/app/prisma/schema.prisma

echo "⚙️  Generating Prisma client..."
npx prisma generate --schema=/app/prisma/schema.prisma

echo "🔧 Building shared packages..."
pnpm --filter @wikitraveler/core build

echo "🚀 Starting WikiTraveler node in development mode..."
exec pnpm --filter @wikitraveler/node dev
