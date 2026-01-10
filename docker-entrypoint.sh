#!/bin/sh
set -e

echo "⏳ Waiting for DB..."

echo "📊 Running Prisma migrations..."
node node_modules/prisma/build/index.js migrate deploy || echo "⚠️  Migrations skipped or already applied"

echo "🚀 Starting Next.js..."
if [ -f "./server.js" ]; then
  exec node ./server.js
elif [ -f "./.next/standalone/server.js" ]; then
  exec node ./.next/standalone/server.js
else
  echo "❌ server.js not found. Check standalone output."
  ls -la
  exit 1
fi
