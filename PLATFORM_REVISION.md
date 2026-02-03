# Ревизия платформы Lec7

**Дата:** февраль 2025  
**Цель:** обзор текущего состояния платформы после этапа «Партнёрство + Telegram».

---

## 1. Структура и зоны ответственности

| Зона | Маршруты | Назначение |
|------|----------|------------|
| **Публика** | `/`, `/visitor`, `/biz/[slug]`, `/u/[slug]` | Витрина, список бизнесов, карточка бизнеса |
| **Вход** | `/login`, `/resident/login`, `/resident/signup`, `/resident/welcome`, `/admin/login` | Авторизация и онбординг |
| **Офис** | `/office`, `/office/businesses/[id]/*` | Личный кабинет: бизнес, профиль, прайсы, партнёрство, заявки, Telegram |
| **Админка** | `/admin`, `/admin/businesses`, `/admin/owner-agent` | Статистика, активация бизнесов, Owner Agent |
| **API** | `/api/*` | Auth, businesses, office/*, ai, agent, integrations/telegram, requests, invoices и др. |

**Итог:** Разделение по зонам понятное. Офис — основной рабочий модуль (бизнес, партнёрство, заявки, Telegram).

---

## 2. Аутентификация и доступ

- **JWT** в cookie `auth_token` и/или заголовке `Authorization`; проверка в `lib/auth.ts`, использование в `lib/middleware.ts` (`getAuthUser`, `requireAuth`, `requireRole`).
- **Layout-защита:** `/office` и `/admin` проверяют пользователя в layout; при отсутствии — редирект на `/resident/login` и `/admin/login` соответственно.
- **API:** маршруты офиса и админки обёрнуты в `requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'])` (или аналогично); проверка владения ресурсом по `businessId` (ownerId) делается в каждом handler.
- **Риск:** единого «проверка доступа к бизнесу по id» нет — везде свой `findUnique` + сравнение `ownerId`. При добавлении новых office-эндпоинтов легко пропустить проверку. Рекомендация: вынести хелпер `assertBusinessAccess(businessId, user)` и использовать его во всех office API.

---

## 3. Данные (Prisma)

- **Ядро:** User, Business, BusinessProfile; заявки (Request — старые, IncomingRequest + IncomingRequestItem — партнёрские); прайсы (PriceList, PriceAssignment); портфолио (BusinessPortfolioItem, BusinessPortfolioPhoto); профиль (phone, telegramUsername, residentNumber, services).
- **Telegram:** Business.telegramChatId, TelegramConnectToken (mode, label), BusinessTelegramRecipient (несколько получателей на бизнес).
- **Прочее:** Category, Invoice, Event, Document, Agent/Conversation-модели — частично или не задействованы в текущих сценариях.
- **Миграции:** есть папка миграций; для продакшена используется `prisma migrate deploy`. Схема и миграции в порядке для текущего функционала.

---

## 4. Ключевые сценарии (кратко)

- **Регистрация/вход** → редирект в офис или админку.
- **Офис:** один бизнес на пользователя (фактически); из офиса — профиль, прайсы, партнёрство (контрагенты, входящие заявки), заявки (создание/отправка), Telegram (подключение, получатели, xlsx).
- **Партнёрство:** прайсы BASE/DERIVED, назначение контрагентов по ИНР, приём/отклонение заявок; Telegram — кнопка «Telegram» открывает панель справа (подключение, получатели, генерация ссылки, нейтральные кнопки).
- **Отправка заявки:** POST `.../requests/send` → создание IncomingRequest + отправка xlsx в Telegram (всем активным получателям или fallback на telegramChatId); ошибки Telegram не ломают ответ API.
- **Витрина/Visitor:** список бизнесов, карточка по slug (`/biz/[slug]`, `/u/[slug]`); контакты, портфолио, модалки — по текущей реализации.

---

## 5. API

- **Office API** под `businessId` в path; авторизация и проверка владения — в каждом route.
- **Telegram:** connect (mode/label), webhook (set_primary / add_recipient), recipients GET/PATCH; send — xlsx через `sendTelegramDocument`.
- **Публичные/общие:** auth, businesses, categories, requests (создание заявки с витрины?), ai — стоит явно зафиксировать, какие из них доступны без офисного JWT и как защищены от злоупотреблений.

---

## 6. Фронт

- **Next.js 14 App Router,** серверные и клиентские компоненты; стили в основном inline.
- **Офис:** крупные клиентские страницы (PartnershipPageClient, RequestsPageClient, BusinessProfileEditor и др.); загрузка данных через fetch + при необходимости `router.refresh()`.
- **ESLint:** предупреждения по зависимостям в `useEffect` в нескольких местах — не блокируют сборку, но их имеет смысл почистить для предсказуемости эффектов.

---

## 7. Деплой и окружение

- **Docker:** есть `Dockerfile`, `docker-compose.yml`; деплой через `git pull` + `docker compose up -d --build app`.
- **Миграции:** на сервере после обновления кода — `npx prisma migrate deploy` (миграция БД не в образе по умолчанию, её нужно выполнять отдельно или в entrypoint).
- **Env:** DATABASE_URL, JWT_SECRET, OPENAI_API_KEY, S3_*, TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET — документированы в README/SETUP; на проде все должны быть заданы.

---

## 8. Рекомендации (приоритет)

1. **Единая проверка доступа к бизнесу:** хелпер `assertBusinessAccess(businessId, user)` в `lib/` и использование во всех office API — меньше риска забыть проверку в новом route.
2. **Документировать публичные API:** какие эндпоинты доступны без офисного JWT, лимиты, защита от спама (например, создание заявки с витрины).
3. **Почистить useEffect-зависимости:** в PartnershipPageClient, PriceUploadModal, RequestsPageClient, VisitorClient и др. — чтобы избежать устаревших замыканий и лишних ререндеров.
4. **Проверка после деплоя:** логин → офис → партнёрство → Telegram (подключение/получатели) → отправка заявки и приход xlsx в Telegram.

---

## 9. Итог

Платформа в текущем виде — монолит на Next.js с чётким разделением на публику, офис и админку. Блок партнёрства и Telegram (несколько получателей, xlsx по заявкам, панель справа, нейтральные кнопки) реализован и согласован с описанными сценариями. Критичных разрывов по безопасности или данным не видно; улучшения в первую очередь — централизация проверки доступа к бизнесу и явная документация публичных API.
