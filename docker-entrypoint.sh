#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma 2>/dev/null || \
  npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss 2>/dev/null || \
  echo "⚠️  Migration warning (may already be up to date)"

echo "🚀 Starting StockRadar..."
exec npx next start -p ${PORT:-3000}
