import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

export type OwnerAgentMode = 'NEXT_STEP' | 'CURSOR_TASK' | 'RISK_CHECK'

export interface OwnerAgentRequest {
  message: string
}

export interface OwnerAgentResponse {
  mode: OwnerAgentMode
  answer: string
}

const SYSTEM_PROMPT = `Ты — Owner Agent платформы Lec7.

Твоя роль:
— помогать Генеральному владельцу Lec7 принимать архитектурные и продуктовые решения
— ускорять разработку платформы
— давать ровно один следующий шаг без разветвлений

Контекст платформы:
Lec7 — это не маркетплейс и не соцсеть.
Это инфраструктура для взаимодействия бизнеса и клиентов:
запрос → диалог → оплата → документы.

Есть две стороны:
— B2B: владельцы бизнесов
— B2C: клиенты, приходящие на страницы бизнесов

Твои ответы ДОЛЖНЫ быть строго одного из трёх режимов:
1) NEXT_STEP — один конкретный следующий шаг, одно действие, без альтернатив
2) CURSOR_TASK — готовое задание для Cursor: цель, файлы, критерии готовности, что не делать
3) RISK_CHECK — кратко: что может сломаться и где проверить

Правила:
— не рассуждай вслух
— не предлагай вариантов
— не используй слова «можно», «возможно», «лучше»
— если запрос расплывчатый — задай ОДИН уточняющий вопрос
— если запрос ясен — сразу ответь в одном режиме

Формат ответа:
mode: NEXT_STEP | CURSOR_TASK | RISK_CHECK
answer: markdown-текст`

function parseAIResponse(text: string): { mode: OwnerAgentMode; answer: string } {
  const trimmedText = text.trim()
  
  // Ищем mode в формате "mode: NEXT_STEP" или "mode:NEXT_STEP"
  const modeMatch = trimmedText.match(/mode\s*:\s*(NEXT_STEP|CURSOR_TASK|RISK_CHECK)/i)
  const mode = modeMatch
    ? (modeMatch[1].toUpperCase() as OwnerAgentMode)
    : 'RISK_CHECK'

  // Ищем answer в формате "answer: ..."
  const answerMatch = trimmedText.match(/answer\s*:\s*([\s\S]*)/i)
  
  let answer = ''
  if (answerMatch) {
    answer = answerMatch[1].trim()
  } else {
    // Если формат "answer:" не найден, пытаемся найти текст после строки с mode
    const modeIndex = trimmedText.search(/mode\s*:\s*(NEXT_STEP|CURSOR_TASK|RISK_CHECK)/i)
    if (modeIndex !== -1) {
      // Берем текст после строки с mode
      const afterMode = trimmedText.substring(modeIndex)
      const lines = afterMode.split('\n')
      
      // Пропускаем строку с mode и ищем строку с answer или берем всё после mode
      let foundAnswer = false
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/answer\s*:/i)) {
          // Нашли строку с answer, берем всё после неё
          answer = lines.slice(i + 1).join('\n').trim()
          // Если пусто, берем текст после двоеточия в той же строке
          if (!answer) {
            const colonIndex = lines[i].indexOf(':')
            if (colonIndex !== -1) {
              answer = lines[i].substring(colonIndex + 1).trim()
            }
          }
          foundAnswer = true
          break
        }
      }
      
      // Если не нашли answer, берем всё после строки с mode
      if (!foundAnswer && lines.length > 1) {
        answer = lines.slice(1).join('\n').trim()
      }
    }
    
    // Если всё ещё пусто, используем весь текст (mode будет RISK_CHECK по умолчанию)
    if (!answer) {
      answer = trimmedText
    }
  }

  // Убираем возможные префиксы "answer:" если они остались
  answer = answer.replace(/^answer\s*:\s*/i, '').trim()

  return { mode, answer }
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

    // Проверяем наличие API ключа
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is missing' },
        { status: 500 }
      )
    }

    if (!openai) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is missing' },
        { status: 500 }
      )
    }

    // Вызываем AI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
    })

    const aiResponse = completion.choices[0]?.message?.content || ''

    if (!aiResponse) {
      return NextResponse.json(
        { error: 'Ошибка получения ответа от AI' },
        { status: 500 }
      )
    }

    // Парсим ответ AI
    const { mode, answer } = parseAIResponse(aiResponse)

    const response: OwnerAgentResponse = {
      mode,
      answer,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Owner Agent API error:', error)
    
    // Не раскрываем детали ошибки (без утечки ключей)
    const errorMessage = error instanceof Error ? error.message : 'Ошибка обработки запроса'
    
    // Если ошибка связана с API ключом, возвращаем понятное сообщение
    if (errorMessage.includes('API key') || errorMessage.includes('OPENAI')) {
      return NextResponse.json(
        { error: 'Ошибка подключения к AI сервису' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Ошибка обработки запроса' },
      { status: 500 }
    )
  }
}
