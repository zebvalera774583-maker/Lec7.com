# Инструкция по запуску проекта Lec7

## Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка базы данных

Создайте файл `.env` в корне проекта:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/lec7?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
OPENAI_API_KEY="sk-your-openai-api-key"
S3_ENDPOINT="https://s3.timeweb.com"
S3_ACCESS_KEY_ID="your-access-key-id"
S3_SECRET_ACCESS_KEY="your-secret-access-key"
S3_BUCKET_NAME="lec7-storage"
S3_REGION="ru-1"
S3_PUBLIC_URL="https://your-bucket.s3.timeweb.com"
```

### 3. Инициализация базы данных

```bash
# Применить схему к БД
npm run db:push

# Или создать миграцию
npm run db:migrate
```

### 4. Запуск в режиме разработки

```bash
npm run dev
```

Приложение будет доступно по адресу: http://localhost:3000

## Структура проекта

```
lec7/
├── app/                    # Next.js App Router
│   ├── (public)/          # Публичная часть (роут-группа)
│   │   └── b/[slug]/     # Витрина бизнеса
│   ├── office/            # Мобильный офис бизнеса
│   ├── admin/             # Админка Lec7
│   ├── api/               # API routes
│   │   ├── auth/         # Аутентификация
│   │   ├── ai/           # AI-чат
│   │   ├── businesses/   # Бизнесы
│   │   ├── portfolio/    # Портфолио
│   │   ├── requests/     # Заявки
│   │   └── invoices/     # Счета
│   └── login/            # Страница входа
├── components/            # React компоненты
│   ├── PortfolioGallery.tsx
│   └── AIChat.tsx
├── lib/                   # Утилиты и библиотеки
│   ├── prisma.ts         # Prisma Client
│   ├── auth.ts           # Аутентификация
│   ├── middleware.ts     # Middleware для проверки прав
│   ├── s3.ts             # S3 storage
│   └── openai.ts         # OpenAI интеграция
├── prisma/
│   └── schema.prisma     # Схема базы данных
└── types/
    └── index.ts          # TypeScript типы
```

## Основные модули

### 1. Витрина (P1.1 + P1.2)
- Публичная страница бизнеса: `/b/[slug]`
- Портфолио с fullscreen просмотром
- AI-чат для связи с клиентами

### 2. Office (Business App)
- `/office` - список бизнесов
- `/office/businesses/[id]` - детали бизнеса
- Управление заявками, счетами, портфолио

### 3. Admin (Lec7 Admin)
- `/admin` - админ-панель
- Статистика по платформе

### 4. API Endpoints

#### Аутентификация
- `POST /api/auth/login` - вход
- `POST /api/auth/register` - регистрация
- `POST /api/auth/logout` - выход

#### Бизнесы
- `POST /api/businesses` - создать бизнес
- `GET /api/businesses` - список бизнесов

#### Портфолио
- `POST /api/portfolio` - загрузить фото
- `GET /api/portfolio?businessId=...` - получить портфолио

#### AI-чат
- `POST /api/ai/chat` - отправить сообщение в AI-чат

#### Заявки
- `POST /api/requests` - создать заявку
- `GET /api/requests?businessId=...` - получить заявки

#### Счета
- `POST /api/invoices` - создать счёт
- `GET /api/invoices?businessId=...` - получить счета

## Роли пользователей

- `visitor` - неавторизованный пользователь (публичная часть)
- `BUSINESS_OWNER` - владелец бизнеса (доступ к `/office`)
- `LEC7_ADMIN` - администратор платформы (доступ к `/admin`)

## Деплой

### Docker

```bash
# Запуск с Docker Compose
docker-compose up -d

# Остановка
docker-compose down
```

### Vercel

1. Подключите репозиторий к Vercel
2. Настройте переменные окружения
3. Deploy

### VPS

1. Установите Docker и Docker Compose
2. Скопируйте `.env` файл на сервер
3. Запустите `docker-compose up -d`

## Следующие шаги

1. ✅ Базовая структура проекта
2. ✅ Multi-tenancy схема
3. ✅ Аутентификация и роли
4. ✅ Портфолио с загрузкой в S3
5. ✅ AI-чат (Комната 14)
6. ✅ Заявки
7. ✅ Счета
8. ⏳ Генерация PDF счетов
9. ⏳ Система оплаты
10. ⏳ Реклама AI модуль
11. ⏳ Бух AI модуль
