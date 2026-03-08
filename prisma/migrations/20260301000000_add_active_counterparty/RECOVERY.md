# Recovery: ActiveCounterparty migration

## Диагностика (выполнить на production)

```sql
-- 1. Структура таблицы
\d "ActiveCounterparty"

-- 2. Текущие записи
SELECT * FROM "ActiveCounterparty";

-- 3. Ожидаемые записи (ACTIVE PriceAssignment)
SELECT DISTINCT pl."businessId", pa."counterpartyBusinessId", COALESCE(pa."respondedAt", pa."createdAt") AS "createdAt"
FROM "PriceAssignment" pa
JOIN "PriceList" pl ON pl.id = pa."priceListId"
WHERE pa.status = 'ACTIVE'
ORDER BY 1, 2;
```

## SQL для восстановления данных (idempotent)

```sql
-- Шаг 1: Очистить таблицу
DELETE FROM "ActiveCounterparty";

-- Шаг 2: Заполнить из ACTIVE PriceAssignment (одна запись на пару businessId + counterpartyBusinessId)
INSERT INTO "ActiveCounterparty" ("id", "businessId", "counterpartyBusinessId", "createdAt")
SELECT
  md5(pl."businessId" || pa."counterpartyBusinessId" || 'active_cp_v1') AS id,
  pl."businessId",
  pa."counterpartyBusinessId",
  max(COALESCE(pa."respondedAt", pa."createdAt")) AS "createdAt"
FROM "PriceAssignment" pa
JOIN "PriceList" pl ON pl.id = pa."priceListId"
WHERE pa.status = 'ACTIVE'
GROUP BY pl."businessId", pa."counterpartyBusinessId";
```

## Команды для production

```bash
# 1. Выполнить SQL (через psql или docker)
docker compose exec -T postgres psql -U lec7 -d lec7 << 'EOF'
DELETE FROM "ActiveCounterparty";
INSERT INTO "ActiveCounterparty" ("id", "businessId", "counterpartyBusinessId", "createdAt")
SELECT
  md5(pl."businessId" || pa."counterpartyBusinessId" || 'active_cp_v1'),
  pl."businessId",
  pa."counterpartyBusinessId",
  max(COALESCE(pa."respondedAt", pa."createdAt"))
FROM "PriceAssignment" pa
JOIN "PriceList" pl ON pl.id = pa."priceListId"
WHERE pa.status = 'ACTIVE'
GROUP BY pl."businessId", pa."counterpartyBusinessId";
EOF

# 2. Пометить миграцию как применённую (таблица уже создана)
npx prisma migrate resolve --applied 20260301000000_add_active_counterparty

# 3. Проверить статус миграций
npx prisma migrate status
```

## После recovery

`prisma migrate deploy` снова будет работать корректно. Следующие миграции (в т.ч. `20260302000000_backfill_price_list_row_master_item`) применятся штатно.
