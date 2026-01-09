#!/bin/bash
# Скрипт для проверки готовности проекта на Timeweb

echo "🔍 Проверка статуса проекта Lec7..."
echo ""

# 1. Проверка Docker
echo "1️⃣ Проверка Docker:"
if command -v docker &> /dev/null; then
    echo "   ✅ Docker установлен: $(docker --version)"
else
    echo "   ❌ Docker не установлен"
    exit 1
fi

if command -v docker-compose &> /dev/null; then
    echo "   ✅ Docker Compose установлен: $(docker-compose --version)"
else
    echo "   ❌ Docker Compose не установлен"
    exit 1
fi
echo ""

# 2. Проверка контейнеров
echo "2️⃣ Проверка контейнеров:"
cd ~/Lec7.com 2>/dev/null || { echo "   ❌ Папка проекта не найдена"; exit 1; }

docker-compose ps
echo ""

# 3. Проверка логов
echo "3️⃣ Последние логи приложения:"
docker-compose logs --tail=20 app
echo ""

# 4. Проверка базы данных
echo "4️⃣ Проверка базы данных:"
if docker-compose exec -T postgres pg_isready -U lec7 &> /dev/null; then
    echo "   ✅ PostgreSQL работает"
else
    echo "   ❌ PostgreSQL не отвечает"
fi
echo ""

# 5. Проверка порта
echo "5️⃣ Проверка порта 3000:"
if netstat -tlnp 2>/dev/null | grep -q ":3000" || ss -tlnp 2>/dev/null | grep -q ":3000"; then
    echo "   ✅ Порт 3000 открыт"
    netstat -tlnp 2>/dev/null | grep ":3000" || ss -tlnp 2>/dev/null | grep ":3000"
else
    echo "   ⚠️  Порт 3000 не слушается (возможно, контейнер не запущен)"
fi
echo ""

# 6. Проверка .env файла
echo "6️⃣ Проверка .env файла:"
if [ -f .env ]; then
    echo "   ✅ .env файл существует"
    if grep -q "DATABASE_URL" .env && grep -q "NEXT_PUBLIC_APP_URL" .env; then
        echo "   ✅ Основные переменные настроены"
    else
        echo "   ⚠️  Некоторые переменные отсутствуют"
    fi
else
    echo "   ❌ .env файл не найден"
fi
echo ""

# 7. Проверка доступности приложения
echo "7️⃣ Проверка доступности приложения:"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|404"; then
    echo "   ✅ Приложение отвечает на localhost:3000"
else
    echo "   ❌ Приложение не отвечает на localhost:3000"
fi
echo ""

echo "📊 Итоговая сводка:"
echo "   - Проверьте статус контейнеров выше"
echo "   - Если контейнеры не запущены: docker-compose up -d"
echo "   - Если есть ошибки: docker-compose logs app"
echo "   - URL: http://194.87.104.179:3000"
