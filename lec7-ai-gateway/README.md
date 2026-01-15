# Lec7 AI Gateway

Минимальный AI-gateway для платформы Lec7.
Используется для безопасного доступа к OpenAI вне Timeweb.

## Переменные окружения

- `OPENAI_API_KEY` — ключ OpenAI
- `LEC7_GATEWAY_SECRET` — секрет для авторизации запросов
- `PORT` — опционально (по умолчанию 3000)

## Запуск локально

```bash
npm install
OPENAI_API_KEY=sk-... \
LEC7_GATEWAY_SECRET=secret123 \
npm start
```

## Проверка

```bash
curl -X POST http://localhost:3000/v1/owner-agent \
  -H "Content-Type: application/json" \
  -H "X-LEC7-GATEWAY-SECRET: secret123" \
  -d '{"message":"Скажи одним предложением, чем ты полезен для Lec7"}'
```

## Endpoints

- `GET /health` — проверка работоспособности
- `POST /v1/owner-agent` — запрос к Owner Agent
