#!/bin/bash
# Скрипт для проверки сброса пароля администратора на сервере
# Использование: ./scripts/verify-password-reset.sh EMAIL NEW_PASSWORD

set -e

EMAIL="${1:-zebvalera774583@gmail.com}"
NEW_PASS="${2}"

if [ -z "$NEW_PASS" ]; then
  echo "Использование: $0 EMAIL NEW_PASSWORD"
  echo "Пример: $0 zebvalera774583@gmail.com MyNewPassword123"
  exit 1
fi

echo "=== Проверка сброса пароля администратора ==="
echo "Email: $EMAIL"
echo ""

# 1. Сброс пароля
echo "1. Сброс пароля через скрипт..."
docker-compose exec -T app env EMAIL="$EMAIL" NEW_PASS="$NEW_PASS" node scripts/reset-admin-password.mjs

echo ""
echo "2. Проверка входа через API..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$NEW_PASS\"}")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ Успешно! HTTP 200"
  echo "Ответ: $BODY"
  
  # Проверяем наличие auth_token в ответе
  if echo "$BODY" | grep -q "success"; then
    echo "✓ В ответе есть success: true"
    echo ""
    echo "=== РЕЗУЛЬТАТ: Пароль успешно сброшен и работает ==="
    exit 0
  else
    echo "⚠ В ответе нет success, но HTTP 200"
    exit 1
  fi
else
  echo "✗ Ошибка! HTTP $HTTP_CODE"
  echo "Ответ: $BODY"
  echo ""
  echo "=== РЕЗУЛЬТАТ: Пароль не работает ==="
  exit 1
fi
