#!/bin/sh
set -e

if [ ! -x node_modules/.bin/next ]; then
  echo "📦 Installing dependencies (first run or empty node_modules volume)..."
  pnpm install --frozen-lockfile
fi

echo "🔧 Building shared packages for Field Kit..."
pnpm --filter @wikitraveler/core build
pnpm --filter @wikitraveler/i18n build
pnpm --filter @wikitraveler/ui build

echo "🚀 Starting Field Kit in development mode (port ${PORT:-3001})..."
exec pnpm --filter @wikitraveler/field-kit exec next dev -p "${PORT:-3001}" -H 0.0.0.0
