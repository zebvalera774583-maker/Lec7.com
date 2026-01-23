# Agent Conversations API

API для работы с чатами агента.

## POST /api/agent/conversations

Создание нового чата агента.

### Требования
- Авторизация через cookie `auth_token` или header `Authorization: Bearer <token>`

### Body
```json
{
  "scope": "PLATFORM" | "BUSINESS" | "PUBLIC",
  "mode": "CREATOR" | "RESIDENT" | "CLIENT",
  "businessId": "string?" (обязателен для scope=BUSINESS),
  "title": "string?" (опционально)
}
```

### Примеры

#### Создание чата для платформы (только для админов)
```json
POST /api/agent/conversations
{
  "scope": "PLATFORM",
  "mode": "CREATOR"
}
```

#### Создание чата для бизнеса
```json
POST /api/agent/conversations
{
  "scope": "BUSINESS",
  "mode": "RESIDENT",
  "businessId": "cmkkxlbpx0006mx397hxvz9hn",
  "title": "План развития бизнеса"
}
```

### Ответ
```json
{
  "conversation": {
    "id": "string",
    "title": "string | null",
    "scope": "PLATFORM" | "BUSINESS" | "PUBLIC",
    "mode": "CREATOR" | "RESIDENT" | "CLIENT",
    "businessId": "string | null",
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
}
```

## GET /api/agent/conversations

Получение списка чатов агента для текущего пользователя.

### Query параметры
- `scope` (опционально): фильтр по scope
- `businessId` (опционально): фильтр по бизнесу

### Примеры

#### Получить все чаты пользователя
```
GET /api/agent/conversations
```

#### Получить чаты для конкретного бизнеса
```
GET /api/agent/conversations?scope=BUSINESS&businessId=cmkkxlbpx0006mx397hxvz9hn
```

### Ответ
```json
{
  "conversations": [
    {
      "id": "string",
      "title": "string | null",
      "scope": "PLATFORM" | "BUSINESS" | "PUBLIC",
      "mode": "CREATOR" | "RESIDENT" | "CLIENT",
      "businessId": "string | null",
      "createdAt": "ISO date",
      "updatedAt": "ISO date",
      "_count": {
        "messages": 5
      }
    }
  ]
}
```

## Безопасность

- PLATFORM scope доступен только для пользователей с ролью `LEC7_ADMIN`
- BUSINESS scope требует проверки владения бизнесом
- Пользователи видят только свои чаты
