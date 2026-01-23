#!/bin/bash
# Скрипт для настройки OPENAI_API_KEY на сервере
# Использование: ./scripts/setup-openai-key.sh YOUR_OPENAI_API_KEY

set -e

API_KEY="${1}"

if [ -z "$API_KEY" ]; then
  echo "Использование: $0 YOUR_OPENAI_API_KEY"
  echo "Пример: $0 sk-proj-..."
  exit 1
fi

echo "=== Настройка OPENAI_API_KEY ==="
echo ""

# Проверяем, есть ли .env файл
if [ -f .env ]; then
  echo "✓ Найден .env файл"
  
  # Проверяем, есть ли уже OPENAI_API_KEY
  if grep -q "^OPENAI_API_KEY=" .env; then
    echo "⚠ OPENAI_API_KEY уже существует в .env"
    echo "Обновляю значение..."
    sed -i "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=$API_KEY|" .env
  else
    echo "Добавляю OPENAI_API_KEY в .env..."
    echo "" >> .env
    echo "OPENAI_API_KEY=$API_KEY" >> .env
  fi
else
  echo "Создаю .env файл..."
  echo "OPENAI_API_KEY=$API_KEY" > .env
fi

echo "✓ OPENAI_API_KEY настроен в .env"
echo ""

# Перезапускаем контейнер app
echo "Перезапускаю контейнер app..."
docker-compose up -d app

echo ""
echo "=== Готово ==="
echo "OPENAI_API_KEY настроен и контейнер перезапущен."
echo "Проверьте работу:"
echo "  curl -X POST https://lec7.com/api/agent/conversations/YOUR_CONVERSATION_ID/messages \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"content\":\"Тест\"}'"
