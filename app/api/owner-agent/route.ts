import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export type OwnerAgentMode = 'NEXT_STEP' | 'CURSOR_TASK' | 'RISK_CHECK'

export interface OwnerAgentRequest {
  message: string
  save_to_playbook?: boolean
  playbook_item?: {
    scope: 'PLATFORM' | 'BUSINESS'
    businessId?: string | null
    title: string
    move: string
    context?: string | null
    outcome?: string | null
    confidence: 'LOW' | 'MEDIUM' | 'HIGH'
    tags?: string[]
  }
  businessId?: string | null
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

/**
 * Читает последние карточки playbook для формирования контекста
 */
async function loadPlaybookContext(businessId?: string | null): Promise<string> {
  try {
    const items: Array<{
      createdAt: Date
      title: string
      outcome: string | null
      confidence: string
      tags: string[]
    }> = []

    // Читаем последние 5 PLATFORM
    const platformItems = await prisma.agentPlaybookItem.findMany({
      where: { scope: 'PLATFORM' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        createdAt: true,
        title: true,
        outcome: true,
        confidence: true,
        tags: true,
      },
    })
    items.push(...platformItems)

    // Если есть businessId, читаем последние 5 BUSINESS
    if (businessId) {
      const businessItems = await prisma.agentPlaybookItem.findMany({
        where: {
          scope: 'BUSINESS',
          businessId,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          createdAt: true,
          title: true,
          outcome: true,
          confidence: true,
          tags: true,
        },
      })
      items.push(...businessItems)
    }

    // Если карточек нет - возвращаем пустую строку
    if (items.length === 0) {
      return ''
    }

    // Форматируем контекст (максимум 10 строк)
    const lines: string[] = []
    for (const item of items.slice(0, 10)) {
      const date = new Date(item.createdAt).toISOString().split('T')[0] // YYYY-MM-DD
      const tagsStr = item.tags && item.tags.length > 0 ? ` #${item.tags.join(' #')}` : ''
      
      if (item.outcome) {
        lines.push(`- [${date}] ${item.title} — ${item.outcome} (${item.confidence})${tagsStr}`)
      } else {
        lines.push(`- [${date}] ${item.title} (${item.confidence})${tagsStr}`)
      }
    }

    return lines.join('\n')
  } catch (error) {
    console.warn('Failed to load playbook context:', error)
    return ''
  }
}

/**
 * Валидирует playbook_item перед сохранением
 */
function validatePlaybookItem(item: OwnerAgentRequest['playbook_item']): { valid: boolean; error?: string } {
  if (!item) {
    return { valid: false, error: 'playbook_item is required when save_to_playbook is true' }
  }

  // Обязательные поля
  if (!item.scope || !item.title || !item.move || !item.confidence) {
    return { valid: false, error: 'Missing required fields: scope, title, move, confidence' }
  }

  // Проверка значений enum
  if (!['PLATFORM', 'BUSINESS'].includes(item.scope)) {
    return { valid: false, error: 'Invalid scope. Must be PLATFORM or BUSINESS' }
  }

  if (!['LOW', 'MEDIUM', 'HIGH'].includes(item.confidence)) {
    return { valid: false, error: 'Invalid confidence. Must be LOW, MEDIUM, or HIGH' }
  }

  // Бизнес-логика: scope=BUSINESS => businessId обязателен
  if (item.scope === 'BUSINESS' && !item.businessId) {
    return { valid: false, error: 'businessId is required when scope is BUSINESS' }
  }

  // Бизнес-логика: scope=PLATFORM => businessId должен быть null
  if (item.scope === 'PLATFORM' && item.businessId) {
    return { valid: false, error: 'businessId must be null when scope is PLATFORM' }
  }

  return { valid: true }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as OwnerAgentRequest
    const { message, save_to_playbook, playbook_item, businessId } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Сообщение не может быть пустым' },
        { status: 400 }
      )
    }

    // Валидация playbook_item если save_to_playbook=true
    if (save_to_playbook) {
      const validation = validatePlaybookItem(playbook_item)
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        )
      }
    }

    // Определяем businessId для чтения контекста
    const contextBusinessId = businessId || (playbook_item?.scope === 'BUSINESS' ? playbook_item.businessId : null)

    // Загружаем контекст из playbook
    const playbookContext = await loadPlaybookContext(contextBusinessId)

    // Формируем message для gateway (с контекстом или без)
    let messageForGateway = message
    if (playbookContext) {
      messageForGateway = `PLAYBOOK_CONTEXT:\n${playbookContext}\n---\nUSER:\n${message}`
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
      body: JSON.stringify({ message: messageForGateway }),
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
    let { mode, answer } = parseAIResponse(reply)

    // Сохраняем в playbook если запрошено
    if (save_to_playbook && playbook_item) {
      try {
        const item = await prisma.agentPlaybookItem.create({
          data: {
            scope: playbook_item.scope,
            businessId: playbook_item.scope === 'PLATFORM' ? null : playbook_item.businessId || null,
            title: playbook_item.title.trim(),
            move: playbook_item.move.trim(),
            context: playbook_item.context?.trim() || null,
            outcome: playbook_item.outcome?.trim() || null,
            confidence: playbook_item.confidence,
            tags: playbook_item.tags || [],
          },
        })

        // Добавляем информацию о сохранении в конец answer
        answer = `${answer}\n\nSAVED_TO_PLAYBOOK: ${item.id}`
      } catch (error) {
        console.error('Failed to save playbook item:', error)
        // Если save_to_playbook=true и запись упала - возвращаем 500
        return NextResponse.json(
          { error: 'Failed to save playbook item' },
          { status: 500 }
        )
      }
    }

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
