#!/bin/bash
# Финальная настройка и запуск проекта - ВСЁ В ОДНОЙ КОМАНДЕ

echo "🚀 Начинаем финальную настройку..."

# 1. Исправляем .env файл
cat > .env << 'EOF'
DATABASE_URL=postgresql://lec7:lec7_password@postgres:5432/lec7?schema=public
NEXT_PUBLIC_APP_URL=http://194.87.104.179:3000
JWT_SECRET=lec7-super-secret-jwt-key-minimum-32-characters-long-2024-change-in-production
OPENAI_API_KEY=sk-your-openai-api-key-here
S3_ENDPOINT=https://s3.timeweb.com
S3_ACCESS_KEY_ID=your-timeweb-s3-access-key
S3_SECRET_ACCESS_KEY=your-timeweb-s3-secret-key
S3_BUCKET_NAME=lec7-storage
S3_REGION=ru-1
S3_PUBLIC_URL=https://lec7-storage.s3.timeweb.com
EOF

# 2. Обновляем docker-compose.yml
sed -i 's|NEXT_PUBLIC_APP_URL: http://localhost:3000|NEXT_PUBLIC_APP_URL: http://194.87.104.179:3000|' docker-compose.yml

# 3. Запускаем проект
echo "📦 Запускаем проект (это займёт несколько минут)..."
docker-compose up -d --build

# 4. Ждём готовности базы данных
echo "⏳ Ждём готовности базы данных..."
sleep 15

# 5. Применяем миграции
echo "📊 Применяем миграции базы данных..."
docker-compose exec -T app npx prisma migrate deploy || docker-compose exec -T app npx prisma db push

echo ""
echo "✅ ГОТОВО! Проект запущен!"
echo "🌐 Откройте в браузере: http://194.87.104.179:3000"
echo ""
echo "📊 Проверить статус: docker-compose ps"
echo "📋 Посмотреть логи: docker-compose logs -f app"
