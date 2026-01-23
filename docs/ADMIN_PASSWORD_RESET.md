# Сброс пароля администратора

## Проблема

Если пароль администратора был изменён напрямую через SQL (например, `UPDATE "User" SET password = '...'`), то вход через `/api/auth/login` может не работать, потому что:

1. Пароль должен быть **хеширован через bcryptjs** с 10 раундами
2. Поле в БД называется `password` (не `passwordHash` или другое)
3. Используется библиотека `bcryptjs` (не `bcrypt`)

## Решение

Используйте скрипт `scripts/reset-admin-password.mjs` для правильного сброса пароля.

### На сервере (Timeweb/SSH)

```bash
# Войдите в контейнер
docker-compose exec app bash

# Установите переменные окружения и запустите скрипт
EMAIL=zebvalera774583@gmail.com NEW_PASS=your_secure_password node scripts/reset-admin-password.mjs
```

Или одной командой:

```bash
docker-compose exec app env EMAIL=zebvalera774583@gmail.com NEW_PASS=your_secure_password node scripts/reset-admin-password.mjs
```

### Локально (для разработки)

```bash
EMAIL=test@example.com NEW_PASS=test123 node scripts/reset-admin-password.mjs
```

## Как это работает

1. Скрипт находит пользователя по email
2. Хеширует новый пароль через `bcryptjs.hash(password, 10)` (как в `lib/auth.ts`)
3. Обновляет поле `password` в таблице `User`
4. Проверяет, что пароль работает через `bcryptjs.compare()`

## Проверка после сброса

### На сервере (Timeweb/SSH)

Используйте скрипт для автоматической проверки:

```bash
cd ~/Lec7.com
./scripts/reset-password-on-server.sh zebvalera774583@gmail.com your_secure_password
```

Или вручную:

```bash
# 1. Сброс пароля
docker-compose exec app env EMAIL=zebvalera774583@gmail.com NEW_PASS=your_secure_password node scripts/reset-admin-password.mjs

# 2. Проверка входа
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"zebvalera774583@gmail.com","password":"your_secure_password"}' \
  -w "\nHTTP: %{http_code}\n"

# Должен вернуть HTTP: 200 и JSON с success: true
```

## Важные детали

- **Поле в БД**: `password` (String)
- **Библиотека**: `bcryptjs` (не `bcrypt`)
- **Раунды**: 10 (как в `lib/auth.ts:hashPassword()`)
- **Проверка**: `bcryptjs.compare()` (как в `lib/auth.ts:verifyPassword()`)

## Если скрипт не работает

1. Убедитесь, что пользователь существует:
   ```sql
   SELECT id, email, role FROM "User" WHERE email = 'zebvalera774583@gmail.com';
   ```

2. Проверьте, что используется правильное поле:
   ```sql
   SELECT id, email, password FROM "User" WHERE email = 'zebvalera774583@gmail.com';
   ```

3. Убедитесь, что пароль хеширован правильно (должен начинаться с `$2a$10$` или `$2b$10$`)
