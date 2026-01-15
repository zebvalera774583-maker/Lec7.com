import { NextRequest, NextResponse } from 'next/server'

export type OwnerAgentMode = 'NEXT_STEP' | 'CURSOR_TASK' | 'RISK_CHECK'

export interface OwnerAgentRequest {
  message: string
}

export interface OwnerAgentResponse {
  mode: OwnerAgentMode
  answer: string
}

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

    // Проверяем наличие env переменных для gateway
    const gatewayUrl = process.env.LEC7_AI_GATEWAY_URL
    const gatewaySecret = process.env.LEC7_GATEWAY_SECRET

    if (!gatewayUrl || !gatewaySecret) {
      return NextResponse.json(
        { error: 'AI gateway configuration is missing' },
        { status: 500 }
      )
    }

    // Вызываем gateway
    const gatewayResponse = await fetch(`${gatewayUrl}/v1/owner-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LEC7-GATEWAY-SECRET': gatewaySecret,
      },
      body: JSON.stringify({ message }),
    })

    if (!gatewayResponse.ok) {
      const errorText = await gatewayResponse.text().catch(() => 'AI gateway error')
      return NextResponse.json(
        { error: 'AI gateway error' },
        { status: 502 }
      )
    }

    const gatewayData = await gatewayResponse.json() as { reply?: string }
    const reply = gatewayData.reply || ''

    if (!reply) {
      return NextResponse.json(
        { error: 'Ошибка получения ответа от AI' },
        { status: 500 }
      )
    }

    // Парсим ответ AI через существующую функцию
    const { mode, answer } = parseAIResponse(reply)

    const response: OwnerAgentResponse = {
      mode,
      answer,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Owner Agent API error:', error)
    
    // Если ошибка связана с fetch (сетевая ошибка), возвращаем 502
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'AI gateway error' },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { error: 'Ошибка обработки запроса' },
      { status: 500 }
    )
  }
}
