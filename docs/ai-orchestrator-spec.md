# Lek7 AI Orchestrator — Спецификация и ТЗ

Документ определяет архитектуру AI-агента Lek7, принципы, слои системы, действия и требования к безопасности. Основан на обсуждениях архитектуры закупочной платформы.

---

## 1. Идея в одной фразе

**AI-мозг = «память бизнеса» + «умение делать действия» + «контроль безопасности».**

Агент не просто отвечает, а управляет закупом, прайсами и коммуникацией. Пользователю не нужно понимать интерфейс — закуп становится «в один диалог».

---

## 2. Слои системы

### A. AI Chat UI (Web / Telegram / MAX)

Единственная задача: принять сообщение и показать ответ + кнопки действий.

### B. Orchestrator (главный диспетчер)

Решает:
- что хотел пользователь (intent)
- какие данные нужны (context)
- какие действия запустить (actions)
- как спросить уточнение, если надо

### C. Actions (инструменты платформы)

Строго определённые функции. См. раздел 6.

### D. Business Memory (память бизнеса)

Хранилище смыслов и привычек:
- какие товары покупают
- как называют товары (синонимы)
- какие поставщики «любимые»
- нормальные диапазоны цен
- расписание закупок

### E. Guardrails (контроль и права)

- проверка роли (резидент/админ)
- ограничения: что можно делать без подтверждения
- журнал действий (audit)

---

## 3. Ключевые архитектурные принципы

### 3.1. LLM — только классификатор

LLM определяет **intent** и **сущности** (товары, даты, объёмы). План действий строит **код**, не LLM.

- Плюс: предсказуемость, контроль, проще отлаживать
- LLM отвечает на «что имелось в виду», а не «что делать дальше»
- Router всегда решает цепочку действий

LLM нужен «словарь мира» (единицы, форматы дат) — в system prompt или справочнике.

### 3.2. Business Memory — расширение текущей БД

Для MVP: новые таблицы в Postgres. Отдельная БД или AI-сервис — позже.

Минимальный набор сущностей:
- **Product Canonical** — canonicalName, unit, synonyms[], category
- **Supplier Profile** — название, надёжность, условия, контакты
- **Price History** — цены по товарам во времени, источник (прайс/сделка)
- **Purchase Patterns** — частота, типовые объёмы (структура заложить, не использовать в MVP)
- **Business Preferences** — preferredSuppliers[], forbiddenCategories[], priceSensitivity

**Price History:** история = фактическая цена сделки (RequestItem.priceAccepted / IncomingRequestItem). Прайс ≠ факт. В MVP достаточно «предложили/отправили», если «купили» ещё не фиксируется.

**ProductSynonym:** оставить `BotCatalogItem.synonyms` (JSON) как есть. Зафиксировать точку расширения — возможность позже вынести в таблицу без поломки API. Если появятся бизнес-специфичные синонимы — потребуется отдельная таблица.

### 3.3. Guardrails — проверки до Actions

Схема: **Router → Auth/Scope/Action-level → Action**

Проверки не в UI, а в коде. Любой вход (Web/Telegram/MAX) проходит одинаковую политику.

**Разделение проверок:**
- **Auth:** кто пользователь (userId), какая роль (role)
- **Scope:** к какому бизнесу привязан (businessId) — **всегда из сессии/привязки, никогда из тела запроса**
- **Action-level:** матрица прав (commit/send только для BUSINESS_OWNER, read-only — шире)

**Telegram/MAX:** нет классической сессии. `businessId` берётся из `MaxChatContext` / `BusinessTelegramRecipient` (привязка chatId → businessId). Пользователь не может передать `businessId` в сообщении — иначе риск доступа к чужому бизнесу.

### 3.4. Write-actions только по подтверждению

- Отправка заявок, создание заявок, изменения прайсов/каталога, приглашения поставщиков — **только по кнопке «Подтвердить»**
- Просмотр, аналитика, расчёты — без подтверждения

### 3.5. Audit

Формат с самого начала:
- userId, businessId, action, input, output (обезличенные), status, createdAt
- Обезличивание на уровне логгера: токены, пароли, секреты → [REDACTED]
- Лимиты: срок хранения подробных логов (30–90 дней), сжатый лог навсегда (кто/что/когда/статус без payload)

---

## 4. Память бизнеса — структура данных

### 4.1. Product Canonical (BotCatalogItem)

- canonicalName, unit, synonyms[], category
- Связь с единым справочником категорий

### 4.2. Supplier Profile

- Название, контакты
- Надёжность/рейтинг (позже)
- Условия (минималка, доставка)

### 4.3. Price History

- Цены по товарам во времени
- Источник: прайс / ручное / сделка
- В MVP: факт отправки заявки с ценой

### 4.4. Business Preferences

- preferredSuppliers[]
- forbiddenCategories[] — **ссылки на единый справочник категорий**, не дублирование
- priceSensitivity, defaultNeedsTemplate (позже)

### 4.5. Категории

Одна «истина»: единый справочник категорий. `PriceList.category`, `BotCatalogItem.category`, `BusinessPreference.forbiddenCategories` — ссылки на него.

---

## 5. Реальный поток (пример)

**Пользователь:** «Сделай закуп на завтра»

**Orchestrator:**
1. Собирает контекст: потребности, последние закупки, типовые «на завтра»
2. Строит план: suggestNeeds() → comparePrices() → generateRequests()
3. Показывает превью: товары, объёмы, поставщики, сумма, экономия
4. Требует подтверждение: кнопка «Подтвердить и отправить»
5. Отправляет: sendRequests()
6. Записывает в память: что купили, по какой цене

**Если нет потребностей:** источник — последние N заявок по времени (не по частоте). «Типичные» паттерны — отдельный слой, не в MVP.

**Если нет цен:** `missingPrices[]` — показать пользователю, не скрывать. Стратегии skip/manual/notify — по мере необходимости.

---

## 6. Planner

План строит **алгоритм**, не LLM. LLM — для объяснений.

Формат плана:
- цель
- шаги
- нужные данные
- действия
- где требуется подтверждение

Правило: действие влияет на деньги/отправляет наружу → только с подтверждением. Просмотр/аналитика → сразу.

---

## 7. AI Actions — спецификация

### 7.1. getBusinessContext

**Назначение:** дать агенту «карту бизнеса».

**Вход:** businessId (из сессии)

**Выход:** business, suppliers, activePriceLists, lastNeeds (5), lastRequests (5), preferences

**requireConfirm:** false

**Ограничение объёма:** lastNeeds: 5, lastRequests: 5 — по времени (createdAt desc). Иначе контекст LLM перегружается.

---

### 7.2. ingestTextNeeds

**Назначение:** превратить текст в структурированные позиции.

**Вход:** businessId, text, locale

**Выход:** items: [{ rawTitle, canonicalCandidate, qty, unit, confidence }]

**requireConfirm:** false

**Реализация:** переиспользовать `parseMaxRequestToRows` (lib/parseMaxRequest.ts), не писать новый парсер.

---

### 7.3. resolveCatalogItems

**Назначение:** сопоставить позиции с каталогом.

**Вход:** businessId, items[]

**Выход:** resolved: [{ catalogItemId, canonicalName, qty, unit, confidence, needsUserChoice }]

**requireConfirm:** false (но может вернуть «нужно выбрать»)

**Реализация:** обёртка над `BotCatalogItem` + synonyms, существующая логика сопоставления.

---

### 7.4. createNeedsDraft

**Назначение:** создать черновик потребности.

**Вход:** businessId, resolvedItems[], plannedForDate

**Выход:** needDraftId, items[], warnings[]

**requireConfirm:** false

**Реализация (MVP):** NeedDraft в session/Redis с TTL (30 мин). Ключ: draft:{chatId}:{businessId}. Без таблицы — быстрее. Для «сохранённых черновиков» позже — таблица RequestDraft.

**Сопоставление с Lek7:** NeedDraft → временное состояние; commitNeeds создаёт Request + IncomingRequest.

---

### 7.5. commitNeeds

**Назначение:** зафиксировать потребности в базе.

**Вход:** businessId, needDraftId

**Выход:** needId

**requireConfirm:** true

**Реализация:** создание Request + IncomingRequest из черновика.

---

### 7.6. compareSupplierPrices

**Назначение:** сравнить цены, подготовить план закупа.

**Вход:** businessId, needId (или needDraftId), strategy: "min_price" | "preferred_suppliers" | "mixed"

**Выход:** plan[], totals, savingsEstimate, missingPrices[]

**requireConfirm:** false

**Реализация:** обёртка над `request-summary` / `price-comparison` API.

---

### 7.7. generateAndSendRequests

**Назначение:** создать заявки и отправить поставщикам.

**Вход:** businessId, plan, channels: ["telegram","email"]

**Выход:** requestIds[], deliveryResults[]

**requireConfirm:** true

**Реализация:** обёртка над `requests/send` API. Расширение: channels[].

---

### 7.8. Бонусные actions (позже)

- **setBusinessPreferences** — запомнить предпочтения (requireConfirm: true)
- **learnSynonym** — сохранить синоним (requireConfirm: false, логировать)
- **auditLogAction** — записывать все действия (обязательно)

---

## 8. Порядок внедрения MVP (1-й релиз)

1. getBusinessContext
2. ingestTextNeeds
3. resolveCatalogItems
4. createNeedsDraft
5. commitNeeds
6. compareSupplierPrices
7. generateAndSendRequests

**Результат:** пользователь пишет «на завтра: огурцы 10 кг, томаты 5 кг» → AI показывает позиции → кнопка «Сохранить» → кнопка «Сравнить цены» → кнопка «Отправить».

---

## 9. Orchestrator Router

Router = intent detection + action chain.

- LLM определяет intent (и сущности)
- Rules проверяют допустимость
- Код выполняет цепочку действий

Пример: intent = create_needs → ingestTextNeeds → resolveCatalogItems → createNeedsDraft.

Объём: 100–150 строк, если Actions уже реализованы.

---

## 10. Несдвигаемые принципы MVP

1. **LLM только классифицирует** — intent + entities. План строит код.
2. **Scope и action-level проверяются до Actions** — единая политика для Web/Telegram/MAX.
3. **businessId из сессии/привязки** — никогда из тела запроса пользователя.
4. **Audit без секретов** — обезличивание, лимиты хранения.
5. **Price History** — чётко определить, что считается («предложили» vs «купили»), проверить заполнение price/sum в IncomingRequestItem.
6. **Переиспользование** — не переписывать Lek7, оборачивать существующую логику в Actions.

---

## 11. Связанные документы

- `docs/ai-actions.md` — детальная спецификация Actions (JSON Schema, ошибки, Related APIs)
- Существующие API: `parseMaxRequestToRows`, `request-summary`, `price-comparison`, `requests/send`, `BotCatalogItem`

---

*Документ актуален на момент создания. Обновляется по мере развития архитектуры.*
