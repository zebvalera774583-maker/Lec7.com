#!/bin/sh
set -e

echo "🚀 Starting application..."

# Генерируем Prisma Client если нужно
if [ ! -d "node_modules/.prisma" ]; then
  echo "📦 Generating Prisma Client..."
  npx prisma generate || echo "⚠️  Prisma generate failed, continuing..."
fi

# Пробуем применить миграции (не критично, если уже применены)
echo "📦 Running Prisma migrations..."
npx prisma migrate deploy || {
  echo "⚠️  Migrations failed or already applied, continuing..."
  # Пробуем db push как fallback
  npx prisma db push --skip-generate || echo "⚠️  DB push also failed, continuing..."
}

# Проверяем наличие server.js
if [ ! -f "server.js" ]; then
  echo "❌ ERROR: server.js not found!"
  echo "📋 Listing files in current directory:"
  ls -la
  echo "📋 Checking .next/standalone:"
  ls -la .next/standalone/ 2>/dev/null || echo "⚠️  .next/standalone not found"
  exit 1
fi

echo "✅ Starting Next.js server..."
exec node server.js
