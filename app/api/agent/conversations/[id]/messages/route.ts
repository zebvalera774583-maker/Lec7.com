import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/agent/conversations/[id]/messages
 * Отправка сообщения в чат и получение ответа от агента
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Проверка аутентификации
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversationId = params.id

    // Проверка существования чата и доступа
    const conversation = await prisma.agentConversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        userId: true,
        scope: true,
        mode: true,
        businessId: true,
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Проверка доступа: пользователь должен быть владельцем чата
    if (conversation.userId !== user.id && user.role !== 'LEC7_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Парсинг body
    const body = await request.json().catch(() => ({}))
    const content = body.content

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Сохранение сообщения пользователя
    const userMessage = await prisma.agentMessage.create({
      data: {
        conversationId,
        role: 'USER',
        content: content.trim(),
      },
    })

    // Получение истории сообщений для контекста (последние 20)
    const messageHistory = await prisma.agentMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: {
        role: true,
        content: true,
      },
    })

    // Подготовка сообщений для OpenAI
    const messages = messageHistory.map((msg) => ({
      role: msg.role === 'USER' ? 'user' : msg.role === 'ASSISTANT' ? 'assistant' : 'system',
      content: msg.content,
    })) as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>

    // Генерация системного промпта в зависимости от mode и scope
    let systemPrompt = ''
    
    if (conversation.mode === 'CREATOR') {
      systemPrompt = `Ты - AI-агент для создателя платформы Lec7. Ты помогаешь с разработкой, DevOps, архитектурой и продуктом. Отвечай профессионально и по делу.`
    } else if (conversation.mode === 'RESIDENT') {
      systemPrompt = `Ты - AI-агент для владельца бизнеса на платформе Lec7. Ты помогаешь с маркетингом, контентом, настройками бизнеса и витриной.`
    } else if (conversation.mode === 'CLIENT') {
      systemPrompt = `Ты - AI-агент для клиента. Ты помогаешь подобрать бизнес, ответить на вопросы и оформить заявку.`
    }

    // Добавление контекста бизнеса, если есть
    if (conversation.scope === 'BUSINESS' && conversation.businessId) {
      const business = await prisma.business.findUnique({
        where: { id: conversation.businessId },
        select: { name: true, description: true },
      })
      
      if (business) {
        systemPrompt += `\n\nКонтекст бизнеса: ${business.name}`
        if (business.description) {
          systemPrompt += `\nОписание: ${business.description}`
        }
      }
    }

    // Вызов AI Gateway или server-side tool в зависимости от запроса
    let assistantContent = 'Извините, произошла ошибка при генерации ответа.'
    let meta: any = null

    const gatewayUrl = process.env.LEC7_AI_GATEWAY_URL
    const gatewaySecret = process.env.LEC7_GATEWAY_SECRET

    // Tool v1: get_platform_business_count
    // Только для CREATOR и LEC7_ADMIN, вопрос вида "сколько бизнесов..."
    const isCreatorAdmin =
      conversation.mode === 'CREATOR' && user.role === 'LEC7_ADMIN'
    const normalizedContent = content.toLowerCase()
    const businessCountPattern =
      /сколько\s+бизнес(ов|а)?/i ||
      /количеств[оа]\s+бизнес(ов|а)?/i ||
      /числ[оа]\s+бизнес(ов|а)?/i

    const isBusinessCountQuestion =
      isCreatorAdmin && /сколько\s+бизнесов|количеств[оа]\s+бизнесов|числ[оа]\s+бизнесов/i.test(normalizedContent)

    if (isBusinessCountQuestion) {
      try {
        const businessCount = await prisma.business.count()
        assistantContent = `На платформе сейчас ${businessCount} бизнесов.`
        meta = {
          tool: 'get_platform_business_count',
          businessCount,
        }
      } catch (error) {
        console.error('Error in get_platform_business_count tool:', error)
        assistantContent =
          'Извините, не удалось получить число бизнесов на платформе. Попробуйте позже.'
      }
    } else {
      if (!gatewayUrl || !gatewaySecret) {
        console.warn('AI Gateway configuration is missing')
        assistantContent =
          'AI не настроен. Пожалуйста, настройте LEC7_AI_GATEWAY_URL и LEC7_GATEWAY_SECRET.'
      } else {
        try {
          // Подготовка messages для Gateway (включая system prompt)
          const gatewayMessages = [
            { role: 'system' as const, content: systemPrompt },
            ...messages,
          ]

          const gatewayResponse = await fetch(`${gatewayUrl}/v1/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-LEC7-GATEWAY-SECRET': gatewaySecret,
            },
            body: JSON.stringify({ messages: gatewayMessages }),
          })

          if (!gatewayResponse.ok) {
            const errorText = await gatewayResponse
              .text()
              .catch(() => 'AI gateway error')
            console.error(
              'AI Gateway error:',
              gatewayResponse.status,
              errorText
            )
            assistantContent =
              'Извините, не удалось получить ответ от AI. Попробуйте позже.'
          } else {
            const data = (await gatewayResponse.json()) as { reply?: string }
            assistantContent = data.reply?.trim() || assistantContent
            meta = {
              model: 'gpt-4o-mini',
              gateway: true,
              gatewayUrl,
            }
          }
        } catch (error) {
          console.error('AI Gateway request error:', error)
          assistantContent =
            'Извините, не удалось получить ответ от AI. Попробуйте позже.'
        }
      }
    }

    // Сохранение ответа агента
    const assistantMessage = await prisma.agentMessage.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: assistantContent,
        meta,
      },
    })

    // Обновление updatedAt у conversation
    await prisma.agentConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
        meta: assistantMessage.meta,
      },
    })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/**
 * GET /api/agent/conversations/[id]/messages
 * Получение истории сообщений чата
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Проверка аутентификации
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversationId = params.id

    // Проверка существования чата и доступа
    const conversation = await prisma.agentConversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        userId: true,
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Проверка доступа
    if (conversation.userId !== user.id && user.role !== 'LEC7_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Парсинг query параметров
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Получение сообщений
    const messages = await prisma.agentMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: Math.min(limit, 100), // Максимум 100 сообщений
      skip: offset,
      select: {
        id: true,
        role: true,
        content: true,
        meta: true,
        createdAt: true,
      },
    })

    // Получение общего количества сообщений
    const total = await prisma.agentMessage.count({
      where: { conversationId },
    })

    return NextResponse.json({
      messages,
      pagination: {
        total,
        limit: Math.min(limit, 100),
        offset,
        hasMore: offset + messages.length < total,
      },
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
