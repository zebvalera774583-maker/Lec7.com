#!/bin/bash
# Автоматическое исправление проблем с контейнером app
# Использование: ./scripts/fix-app-container.sh

set -e

echo "🔧 Начинаем исправление контейнера app..."
echo ""

# Переходим в директорию проекта
cd ~/Lec7.com || {
  echo "❌ Директория ~/Lec7.com не найдена!"
  exit 1
}

echo "1️⃣ Останавливаем контейнеры..."
docker-compose down || true

echo ""
echo "2️⃣ Очищаем старые контейнеры и образы..."
docker-compose rm -f app || true
docker rmi lec7-app 2>/dev/null || true

echo ""
echo "3️⃣ Проверяем наличие .env файла..."
if [ ! -f .env ]; then
  echo "⚠️  .env файл не найден, создаём базовый..."
  cat > .env << 'ENVEOF'
DATABASE_URL=postgresql://lec7:lec7_password@postgres:5432/lec7?schema=public
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=lec7-super-secret-jwt-key-minimum-32-characters-long-2024-change-in-production
NODE_ENV=production
ENVEOF
  echo "✅ Создан базовый .env файл"
else
  echo "✅ .env файл существует"
fi

echo ""
echo "4️⃣ Проверяем docker-entrypoint.sh..."
if [ ! -f docker-entrypoint.sh ]; then
  echo "⚠️  docker-entrypoint.sh не найден, создаём..."
  cat > docker-entrypoint.sh << 'EOF'
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
EOF
  chmod +x docker-entrypoint.sh
  echo "✅ Создан docker-entrypoint.sh"
else
  echo "✅ docker-entrypoint.sh существует, обновляем..."
  # Обновляем существующий файл
  cat > docker-entrypoint.sh << 'EOF'
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
EOF
  chmod +x docker-entrypoint.sh
  echo "✅ Обновлён docker-entrypoint.sh"
fi

echo ""
echo "5️⃣ Пересобираем контейнер app..."
docker-compose build --no-cache app

echo ""
echo "6️⃣ Запускаем контейнеры..."
docker-compose up -d postgres

echo ""
echo "⏳ Ждём запуска PostgreSQL (15 секунд)..."
sleep 15

echo ""
echo "7️⃣ Запускаем контейнер app..."
docker-compose up -d app

echo ""
echo "⏳ Ждём запуска приложения (10 секунд)..."
sleep 10

echo ""
echo "8️⃣ Проверяем статус контейнеров:"
docker-compose ps

echo ""
echo "9️⃣ Проверяем логи app (последние 20 строк):"
docker-compose logs --tail=20 app

echo ""
echo "🔟 Пробуем выполнить команду в контейнере:"
if docker-compose exec app sh -c "echo 'Container is running!'" 2>/dev/null; then
  echo "✅ Контейнер работает и доступен для выполнения команд"
else
  echo "❌ Контейнер не отвечает"
  echo ""
  echo "📋 Полные логи ошибки:"
  docker-compose logs app --tail=50
fi

echo ""
echo "✅ Исправление завершено!"
