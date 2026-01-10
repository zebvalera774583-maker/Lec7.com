#!/bin/sh
set -e

echo "🚀 Starting Next.js..."
exec node ./.next/standalone/server.js
