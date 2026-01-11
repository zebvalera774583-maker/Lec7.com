# Инструкции по миграциям Prisma на Timeweb/SSH

## Автоматическое применение миграций

### Вариант 1: Через отдельный Docker Compose сервис (рекомендуется)

Создайте файл `docker-compose.migrate.yml`:

```yaml
version: "3.9"

services:
  migrate:
    image: node:18-alpine
    container_name: lec7-migrate
    working_dir: /app
    volumes:
      - .:/app
    environment:
      DATABASE_URL: postgresql://lec7:lec7_password@postgres:5432/lec7?schema=public
    command: sh -c "npm install && npx prisma migrate deploy"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - default

networks:
  default:
    external: true
    name: lec7-com_default
```

**Применение:**
```bash
cd ~/Lec7.com
docker-compose -f docker-compose.migrate.yml run --rm migrate
```

### Вариант 2: Ручное применение через SSH

```bash
cd ~/Lec7.com

# 1. Обновить код из GitHub
git pull origin main

# 2. Убедиться, что Postgres запущен
docker-compose ps postgres

# 3. Применить миграции
docker-compose exec app npx prisma migrate deploy

# Или напрямую через node:
docker-compose exec app node node_modules/prisma/build/index.js migrate deploy
```

### Вариант 3: Вручную через один разовый контейнер

```bash
cd ~/Lec7.com
docker run --rm \
  --network lec7-com_default \
  -v $(pwd):/app \
  -w /app \
  -e DATABASE_URL="postgresql://lec7:lec7_password@postgres:5432/lec7?schema=public" \
  node:18-alpine \
  sh -c "npm install && npx prisma migrate deploy"
```

## Создание новой миграции

**Внимание:** Миграции создаются локально, затем коммитятся и пушатся в GitHub.

```bash
# Локально (на вашем ПК)
# 1. Убедиться, что есть .env с DATABASE_URL
# 2. Создать миграцию
npx prisma migrate dev --name название_миграции

# 3. Закоммитить и запушить
git add prisma/migrations
git commit -m "Add migration: название_миграции"
git push origin main
```

## Применение на сервере

После пуша в GitHub:

```bash
# На сервере (Timeweb/SSH)
cd ~/Lec7.com
git pull origin main
docker-compose exec app npx prisma migrate deploy
```

## Проверка статуса миграций

```bash
# Проверить какие миграции применены
docker-compose exec app npx prisma migrate status
```

## Важно

- ✅ Миграции НЕ запускаются автоматически в `docker-entrypoint.sh`
- ✅ Миграции применяются вручную через `prisma migrate deploy`
- ✅ Миграции создаются локально через `prisma migrate dev`
- ❌ Не использовать `prisma migrate dev` на сервере (только `migrate deploy`)
