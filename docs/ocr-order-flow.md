# Логика считывания файла заявки (OCR)

Как система обрабатывает изображение заявки (фото таблицы, Excel-скриншот, PDF-превью).

---

## 1. Вход

**Источник:** MAX-бот получает вложение (фото или превью PDF/Excel).

**Формат:** PNG, JPEG, WEBP (картинка).

**Важно:** MAX часто присылает PDF/Excel как **превью** (image/webp), а не оригинальный файл. В этом случае доступен только OCR по картинке.

---

## 2. Определение типа вложения

```
Вложение приходит → проверяем type и Content-Type
```

- **type=file/document + mime=application/pdf** → ветка PDF (скачивание, parse-pdf API)
- **type=image** или **Content-Type=image/*** → ветка OCR
- Если Content-Type при скачивании = **application/pdf** → ветка PDF (даже при type=image)

---

## 3. OCR (Yandex Vision)

**API:** `POST https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText`  
**Модель:** `table`  
**Параметры:** `mimeType`, `languageCodes: ['ru']`, `content` (base64)

**Ответ:** JSON с `result.textAnnotation.tables[]` или `result.textAnnotation.blocks[]`

---

## 4. Извлечение строк (два пути)

### 4.1. Путь A: таблица (если есть `tables[].cells[]`)

**Структура колонок:** col0=номенклатура, col1=игнор, col2=количество и ед.изм.

1. Берём `tables[].cells[]` с полями `rowIndex`, `columnIndex`, `text`
2. Группируем ячейки по `rowIndex`, сортируем по `columnIndex`
3. Для каждой строки: **сначала** парсим col2 (qty+unit), если валидно — берём col0 как название. Col1 игнорируем.
4. При 6+ колонках: левая часть (0-2), затем правая (3-5)
5. Служебные строки (заголовки, категории) отбрасываются

**Старт считывания:** строки до заголовка «ОВОЩИ» (включая «Овощи очищенные») пропускаются. Считывание начинается после «ОВОЩИ».

**Служебные строки (фильтр):**
- Кухня, Подразделение, Дата заявки, Фамилия заказчика
- Номенклатура, Количество, ед. изм., Наименование
- Овощи, Зелень, Фрукты, Ягоды, Сухофрукты, Орехи
- Овощи очищенные, Сухофрукты/ Орехи

### 4.2. Путь B: блоки (если нет таблицы)

1. Берём `blocks[].lines[].text`
2. Пропускаем строки до заголовка «ОВОЩИ» (считывание начинается после него)
3. Фильтруем мусор (номера строк, одиночные символы)
4. Собираем разорванные строки: `unit_only` + `qty+unit` → `prev + line`

---

## 5. Постобработка (`postProcessTableRows`)

### 5.1. Нормализация единиц в каждой строке

| Было | Стало |
|------|-------|
| `10к` | `10 кг` |
| `1кг` | `1 кг` |
| `4шт` | `4 шт` |
| `КГ. 2кг` | `2 кг` |
| `З 3` | `3 3` (OCR: З→3) |

### 5.2. Склейка разорванных строк

Если строка:
- **Текущая:** только буквы (название без числа)
- **Следующая:** `qty+unit` (например `2 кг`, `0.5кг`)

→ объединяем: `"Лист салата" + "КГ. 2кг"` → `"Лист салата 2 кг"`

---

## 6. Webhook (Lec7)

**Вход:** `{ chatId, text, lines, source: 'max_photo' }`

**Для max_photo:**
1. Берём `lines` или `text.split('\n')`
2. Применяем `postProcessTableRows(rawLines)`
3. Результат: `"название кол-во ед\n..."` → `handleBotEvent`

---

## 7. Дальнейшая обработка

`handleBotEvent` → `recognizeNeedsForChat` → `normalizeIncomingOrder` → `recognizeOrderWithAI`:

- AI разбирает текст в `{ name, quantity, unit }`
- Сопоставление с каталогом
- Уточнения (unit, qty, clarification)
- Создание заявки

---

## Схема потока

```
[Фото/превью] 
    → max-bot: detect type
    → PDF? → download → parse-pdf API → text
    → Image? → download → Yandex OCR (model=table)
         → tables? → extractTableRows → postProcessTableRows
         → else → blocks → reconstructOcrLines
    → webhook: postProcessTableRows(lines)
    → handleBotEvent(text)
    → recognizeOrderWithAI
    → заявка
```

---

## Возможные ошибки

1. **Нет таблицы в ответе** — Yandex возвращает только `blocks`, структура таблицы теряется
2. **Превью вместо оригинала** — PDF/Excel приходит как картинка, OCR хуже
3. **Разорванные строки** — название в одной строке, qty+unit в другой
4. **Номер строки как количество** — "Тархун 26" (26 = номер строки)
5. **Смешанные колонки** — OCR путает строки/колонки в сложных таблицах

---

## Файлы

| Файл | Роль |
|------|------|
| `services/max-bot-service/src/index.ts` | Приём, детект PDF/image, OCR, вызов webhook |
| `lib/ai/yandexVisionOCR.ts` | Yandex OCR, `extractTableRowsFromResponse` |
| `lib/ocr/orderImage.ts` | `postProcessTableRows`, `normalizeTableRowText`, `extractTableItems` |
| `app/api/integrations/max/webhook/route.ts` | `postProcessTableRows` для max_photo |
