# Lec7 v1

Платформа для бизнеса с AI-интеграцией.

## 🚀 Быстрый старт

**Начинайте отсюда:** [START_HERE.md](./START_HERE.md) - пошаговая инструкция для деплоя на Timeweb

## Технический стек

- **Frontend**: Next.js 14 (App Router) + React + TypeScript
- **Backend**: Next.js API routes / route handlers
- **Database**: PostgreSQL + Prisma
- **Storage**: S3-compatible (Timeweb/S3 или Cloudflare R2)
- **AI**: OpenAI API

## Архитектура

- Монолитная структура с модульной организацией
- Multi-tenancy с первого дня
- Разделение на:
  - `/` и `/b/[slug]` — публичная витрина (Client App)
  - `/office` — мобильный офис бизнеса (Business App)
  - `/admin` — админка Lec7

## Роли

- `visitor` — неавторизованный пользователь
- `business_owner` — владелец бизнеса
- `lec7_admin` — администратор платформы

## Разработка

```bash
# Установка зависимостей
npm install

# Запуск dev сервера
npm run dev

# Работа с БД
npm run db:generate  # Генерация Prisma Client
npm run db:push      # Применить схему к БД
npm run db:migrate   # Создать миграцию
npm run db:studio    # Открыть Prisma Studio
```

## Переменные окружения

Создайте `.env` файл:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/lec7"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
JWT_SECRET="your-secret-key"
OPENAI_API_KEY="your-openai-key"
S3_ENDPOINT="your-s3-endpoint"
S3_ACCESS_KEY_ID="your-access-key"
S3_SECRET_ACCESS_KEY="your-secret-key"
S3_BUCKET_NAME="your-bucket-name"
S3_REGION="your-region"
S3_PUBLIC_URL="https://your-bucket.s3.timeweb.com"
```

## Деплой

### Быстрый старт
См. [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) для быстрого деплоя за 5 минут.

### Подробные инструкции
- [DEPLOY.md](./DEPLOY.md) - полная инструкция по деплою (Vercel, VPS, Timeweb)
- [SETUP.md](./SETUP.md) - настройка проекта для разработки

### Варианты деплоя:
- **Vercel** - самый простой, автоматический деплой из Git
- **VPS + Docker** - полный контроль, подходит для Timeweb
- **Timeweb Cloud** - российский хостинг с хорошей поддержкой
