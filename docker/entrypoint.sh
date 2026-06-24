#!/bin/sh
set -e

echo "⏳ Running Prisma migrations..."
prisma migrate deploy --schema=/app/prisma/schema.prisma

echo "🚀 Starting WikiTraveler node..."
exec node apps/node/server.js
