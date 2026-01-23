#!/bin/bash
# Простая команда для сброса пароля на сервере Timeweb/SSH
# Использование: ./scripts/reset-password-on-server.sh EMAIL NEW_PASSWORD

EMAIL="${1}"
NEW_PASS="${2}"

if [ -z "$EMAIL" ] || [ -z "$NEW_PASS" ]; then
  echo "Использование: $0 EMAIL NEW_PASSWORD"
  echo "Пример: $0 zebvalera774583@gmail.com MyNewPassword123"
  exit 1
fi

echo "=== Сброс пароля администратора ==="
echo "Email: $EMAIL"
echo ""

# Выполняем сброс пароля
docker-compose exec app env EMAIL="$EMAIL" NEW_PASS="$NEW_PASS" node scripts/reset-admin-password.mjs

echo ""
echo "=== Проверка входа ==="
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$NEW_PASS\"}" \
  -w "\nHTTP: %{http_code}\n" \
  -s | head -20

echo ""
echo "Если HTTP: 200 - пароль работает!"
