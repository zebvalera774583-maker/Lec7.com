# Бизнес-логика «Действующие контрагенты» (подтверждено)

## Решение: Вариант B — исторические связи

- **Раз подтверждено — остаётся.** Контрагент не теряется при удалении прайса.
- **Удаление только вручную** — при нажатии «Удалить» в таблице на странице Партнёрство → Контрагенты (`?section=counterparties`).

## Реализация

| Действие | Поведение |
|----------|-----------|
| Принять заявку | `ensureActiveCounterparty` добавляет запись |
| Удалить прайс | Запись в ActiveCounterparty **не трогаем** |
| Отозвать назначение (DECLINED) | Запись в ActiveCounterparty **не трогаем** |
| Нажать «Удалить» в таблице | DELETE `/partnership/counterparties/[id]` — удаляет из ActiveCounterparty и переводит PriceAssignment в DECLINED |

## Файлы

- `lib/activeCounterparty.ts` — ensureActiveCounterparty (только добавление)
- `app/api/office/businesses/[id]/partnership/counterparties/[partnerId]/route.ts` — DELETE удаляет из ActiveCounterparty
