#!/bin/bash
# DevOps скрипт для исправления контейнера app
# Использование: ./scripts/devops-fix-app.sh

set -e

echo "🔧 DevOps: Исправление контейнера app"
echo "======================================"
echo ""

# Переходим в директорию проекта
cd ~/Lec7.com || {
  echo "❌ Директория ~/Lec7.com не найдена!"
  exit 1
}

echo "📊 ШАГ 1: Диагностика текущего состояния"
echo "=========================================="
echo ""
echo "Статус контейнеров:"
docker-compose ps
echo ""

echo "Логи app (последние 50 строк):"
docker-compose logs app --tail=50 || echo "⚠️  Логи недоступны"
echo ""

echo "🔧 ШАГ 2: Остановка и очистка"
echo "=============================="
docker-compose down || true
docker-compose rm -f app || true
echo "✅ Контейнеры остановлены"
echo ""

echo "🔧 ШАГ 3: Проверка файлов"
echo "========================"
if [ ! -f docker-entrypoint.sh ]; then
  echo "❌ docker-entrypoint.sh не найден!"
  exit 1
fi

if [ ! -f .env ]; then
  echo "⚠️  .env файл не найден, создаём базовый..."
  cat > .env << 'ENVEOF'
DATABASE_URL=postgresql://lec7:lec7_password@postgres:5432/lec7?schema=public
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=lec7-super-secret-jwt-key-minimum-32-characters-long-2024-change-in-production
NODE_ENV=production
ENVEOF
fi

chmod +x docker-entrypoint.sh
echo "✅ Файлы проверены"
echo ""

echo "🔧 ШАГ 4: Пересборка контейнера app"
echo "===================================="
docker-compose build --no-cache app
echo "✅ Контейнер пересобран"
echo ""

echo "🔧 ШАГ 5: Запуск PostgreSQL"
echo "=========================="
docker-compose up -d postgres
echo "⏳ Ждём готовности PostgreSQL (20 секунд)..."
sleep 20
echo "✅ PostgreSQL запущен"
echo ""

echo "🔧 ШАГ 6: Запуск контейнера app"
echo "==============================="
docker-compose up -d app
echo "⏳ Ждём запуска приложения (15 секунд)..."
sleep 15
echo ""

echo "📊 ШАГ 7: Проверка статуса"
echo "========================="
docker-compose ps
echo ""

echo "📋 Логи app (последние 30 строк):"
docker-compose logs app --tail=30
echo ""

echo "🔧 ШАГ 8: Проверка доступности контейнера"
echo "=========================================="
if docker-compose exec app sh -c "echo 'Container is running!'" 2>/dev/null; then
  echo "✅ Контейнер работает и доступен для выполнения команд"
else
  echo "❌ Контейнер не отвечает"
  echo ""
  echo "📋 Полные логи ошибки:"
  docker-compose logs app --tail=100
  echo ""
  echo "❌ Исправление не удалось. Проверьте логи выше."
  exit 1
fi

echo ""
echo "✅ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!"
echo ""
echo "📊 Финальный статус контейнеров:"
docker-compose ps
echo ""
echo "🌐 Проверьте приложение:"
echo "   - http://localhost:3000/owner"
echo "   - http://localhost:3000/owner/businesses"
