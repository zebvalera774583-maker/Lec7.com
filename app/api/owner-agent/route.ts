import { NextRequest, NextResponse } from 'next/server'

export type OwnerAgentMode = 'NEXT_STEP' | 'CURSOR_TASK' | 'RISK_CHECK'

export interface OwnerAgentRequest {
  message: string
}

export interface OwnerAgentResponse {
  mode: OwnerAgentMode
  answer: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as OwnerAgentRequest
    const { message } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Сообщение не может быть пустым' },
        { status: 400 }
      )
    }

    // Заглушка логики определения режима
    const lowerMessage = message.toLowerCase()
    let mode: OwnerAgentMode = 'RISK_CHECK'

    if (lowerMessage.includes('следующий шаг') || lowerMessage.includes('next step')) {
      mode = 'NEXT_STEP'
    } else if (
      lowerMessage.includes('сделай в cursor') ||
      lowerMessage.includes('задание') ||
      lowerMessage.includes('cursor task') ||
      lowerMessage.includes('task')
    ) {
      mode = 'CURSOR_TASK'
    }

    // Заглушка ответа в зависимости от режима
    let answer = ''

    switch (mode) {
      case 'NEXT_STEP':
        answer = `## Следующий шаг\n\nНа основе вашего запроса, рекомендую:\n\n1. **Проанализировать текущее состояние**\n   - Проверить логи и ошибки\n   - Оценить производительность\n\n2. **Определить приоритеты**\n   - Что критично для пользователей?\n   - Что блокирует развитие?\n\n3. **Составить план действий**\n   - Разбить на небольшие задачи\n   - Определить зависимости\n\n*Это заглушка. В будущем здесь будет реальный AI-анализ.*`
        break

      case 'CURSOR_TASK':
        answer = `## Задание для Cursor\n\n### Описание задачи\n${message}\n\n### Рекомендуемый подход\n\n1. **Изучить контекст**\n   - Проверить существующий код\n   - Найти похожие реализации\n\n2. **Спроектировать решение**\n   - Определить компоненты\n   - Спланировать изменения\n\n3. **Реализовать**\n   - Написать код\n   - Добавить тесты\n   - Обновить документацию\n\n*Это заглушка. В будущем здесь будет детальный план с кодом.*`
        break

      case 'RISK_CHECK':
      default:
        answer = `## Проверка рисков\n\n### Анализ запроса\n\n**Ваш запрос:**\n> ${message}\n\n### Потенциальные риски\n\n1. **Технические риски**\n   - Изменения могут затронуть существующую функциональность\n   - Требуется тестирование\n\n2. **Риски производительности**\n   - Проверить влияние на скорость работы\n   - Оценить нагрузку на БД\n\n3. **Риски безопасности**\n   - Проверить авторизацию и валидацию\n   - Убедиться в защите данных\n\n### Рекомендации\n\n- Перед внедрением провести код-ревью\n- Протестировать на dev-окружении\n- Подготовить план отката\n\n*Это заглушка. В будущем здесь будет реальный анализ рисков.*`
        break
    }

    const response: OwnerAgentResponse = {
      mode,
      answer,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Owner Agent API error:', error)
    return NextResponse.json(
      { error: 'Ошибка обработки запроса' },
      { status: 500 }
    )
  }
}
