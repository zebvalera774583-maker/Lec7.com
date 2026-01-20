import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/middleware'

type AIIntent = 'owner' | 'resident_marketing'

interface AIRequestBody {
  message: string
  intent: AIIntent
  businessId?: string | null
  conversationId?: string | null
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const user = getAuthUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: AIRequestBody

  try {
    body = (await request.json()) as AIRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { message, intent, businessId, conversationId } = body
  const continued = Boolean(conversationId)

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  if (intent !== 'owner' && intent !== 'resident_marketing') {
    return NextResponse.json({ error: 'Invalid intent' }, { status: 400 })
  }

  // AuthZ по intent
  if (intent === 'owner') {
    // Помощник владельца платформы Lec7
    if (user.role !== 'LEC7_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  let targetBusinessId: string | null = null
  let existingConversation:
    | (Awaited<ReturnType<typeof prisma.conversation.findUnique>> & { messages?: any[] })
    | null = null

  // Если передан conversationId — работаем с существующей беседой
  if (continued) {
    existingConversation = await prisma.conversation.findUnique({
      where: { id: conversationId as string },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!existingConversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    if (existingConversation.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (existingConversation.intent !== intent) {
      return NextResponse.json({ error: 'Intent mismatch for this conversation' }, { status: 400 })
    }
  }

  if (intent === 'resident_marketing') {
    // Резидент = владелец бизнеса
    if (user.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // При продолжении диалога учитываем businessId из беседы
    const conversationBusinessId = existingConversation?.businessId || null
    targetBusinessId = businessId || user.businessId || conversationBusinessId

    if (!targetBusinessId) {
      return NextResponse.json(
        { error: 'businessId is required for resident_marketing intent' },
        { status: 400 }
      )
    }

    // Если в существующей беседе закреплён businessId, он должен совпадать
    if (conversationBusinessId && conversationBusinessId !== targetBusinessId) {
      return NextResponse.json(
        { error: 'businessId does not match existing conversation' },
        { status: 400 }
      )
    }

    // Проверяем, что бизнес существует и принадлежит пользователю
    const business = await prisma.business.findFirst({
      where: {
        id: targetBusinessId,
        ownerId: user.id,
      },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found or forbidden' }, { status: 404 })
    }
  }

  // Готовим system prompt
  let systemPrompt = ''
  let gatewayMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

  try {
    // 1. Формируем system prompt
    if (intent === 'owner') {
      systemPrompt = `
Ты — AI-помощник владельца платформы Lec7.

Твой фокус:
- архитектура и развитие продукта Lec7;
- проектирование фич, API, данных и инфраструктуры;
- формулировка чётких технических задач для разработки (в том числе для Cursor);
- оценка рисков, зависимостей и следующих шагов.

Принципы:
- никакой художественной публицистики, работай инженерно и прагматично;
- предлагай понятные следующие шаги (что делать прямо сейчас);
- если уместно — формулируй задание в виде короткого PROMPT для Cursor.
`.trim()

    } else {
      // resident_marketing
      if (!targetBusinessId) {
        return NextResponse.json(
          { error: 'businessId is required for resident_marketing intent' },
          { status: 400 }
        )
      }

      const business = await prisma.business.findUnique({
        where: { id: targetBusinessId },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          city: true,
          category: true,
          profile: {
            select: {
              services: true,
            },
          },
        },
      })

      if (!business) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 })
      }

      const landingUrl = business.slug ? `https://lec7.com/biz/${business.slug}` : 'страница бизнеса в Lec7'

      const servicesText =
        business.profile?.services && business.profile.services.length > 0
          ? `Ключевые услуги/товары: ${business.profile.services.join(', ')}.`
          : ''

      const businessContext = `
Бизнес:
- Название: ${business.name}
- Категория: ${business.category || 'не указана'}
- Город: ${business.city || 'не указан'}
- Описание: ${business.description || 'не указано'}
${servicesText ? `- ${servicesText}` : ''}

Цель рекламы: заявки, звонки, продажи.
Трафик ведём на страницу бизнеса Lec7: ${landingUrl}
`.trim()

      systemPrompt = `
Ты — маркетинговый стратег по внешней рекламе для малого бизнеса.

Контекст бизнеса:
${businessContext}

Твой фокус:
- только внешняя реклама (Яндекс Директ, VK Реклама, Telegram, SEO);
- НЕ предлагай внутреннюю рекламу или промо внутри Lec7;
- помоги:
  - определить и сегментировать целевую аудиторию;
  - выбрать каналы и формат кампаний;
  - сформировать чёткие офферы;
  - написать тексты объявлений и креативы;
  - подготовить UTM-метки и структуру кампаний;
  - дать план запуска, тестов и оптимизации.

Отвечай структурированно, по шагам, на деловом русском языке.
`.trim()

    }

    // 2. Создаём/обновляем Conversation и сообщения
    let conversationIdToUse: string

    if (continued && existingConversation) {
      conversationIdToUse = existingConversation.id

      // Добавляем новое юзерское сообщение в существующую беседу
      await prisma.message.create({
        data: {
          conversationId: conversationIdToUse,
          role: 'user',
          content: message.trim(),
        },
      })
    } else {
      // Создаём новую беседу
      const newConversation = await prisma.conversation.create({
        data: {
          userId: user.id,
          intent,
          businessId: targetBusinessId,
        },
      })
      conversationIdToUse = newConversation.id

      // Первое юзерское сообщение
      await prisma.message.create({
        data: {
          conversationId: conversationIdToUse,
          role: 'user',
          content: message.trim(),
        },
      })
    }

    // 3. Читаем историю последних N сообщений для передачи в gateway
    const HISTORY_LIMIT = 12
    const historyMessages = await prisma.message.findMany({
      where: { conversationId: conversationIdToUse },
      orderBy: { createdAt: 'asc' },
      take: HISTORY_LIMIT,
    })

    gatewayMessages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    // Вызов AI gateway
    const gatewayUrl = process.env.LEC7_AI_GATEWAY_URL
    const gatewaySecret = process.env.LEC7_GATEWAY_SECRET

    if (!gatewayUrl || !gatewaySecret) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'AI_INTENT_CALL',
          metadata: {
            intent,
            businessId: targetBusinessId,
            success: false,
            error: 'AI gateway configuration is missing',
            continued,
          },
        },
      })

      return NextResponse.json(
        { error: 'AI gateway configuration is missing' },
        { status: 500 }
      )
    }

    const gatewayResponse = await fetch(`${gatewayUrl}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LEC7-GATEWAY-SECRET': gatewaySecret,
      },
      body: JSON.stringify({ messages: gatewayMessages }),
    })

    if (!gatewayResponse.ok) {
      const errorText = await gatewayResponse.text().catch(() => 'AI gateway error')

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'AI_INTENT_CALL',
          metadata: {
            intent,
            businessId: targetBusinessId,
            success: false,
            error: 'AI gateway error',
            status: gatewayResponse.status,
            errorText,
            continued,
          },
        },
      })

      return NextResponse.json({ error: 'AI gateway error' }, { status: 502 })
    }

    const data = (await gatewayResponse.json()) as { reply?: string }
    const reply = data.reply?.trim() || ''

    if (!reply) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'AI_INTENT_CALL',
          metadata: {
            intent,
            businessId: targetBusinessId,
            success: false,
            error: 'Empty AI reply',
            continued,
          },
        },
      })

      return NextResponse.json({ error: 'Empty AI reply' }, { status: 500 })
    }

    // Сохраняем ответ ассистента в беседу
    await prisma.message.create({
      data: {
        conversationId: conversationIdToUse,
        role: 'assistant',
        content: reply,
      },
    })

    const finalConversationId = conversationIdToUse

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'AI_INTENT_CALL',
        metadata: {
          intent,
          businessId: targetBusinessId,
          success: true,
          conversationId: finalConversationId,
          durationMs: Date.now() - startedAt,
          continued,
        },
      },
    })

    // Читаем последние N сообщений для отдачи клиенту
    const latestMessages = await prisma.message.findMany({
      where: { conversationId: finalConversationId },
      orderBy: { createdAt: 'asc' },
      take: 12,
    })

    return NextResponse.json({
      conversationId: finalConversationId,
      messages: latestMessages,
      reply,
    })
  } catch (error) {
    console.error('Unified AI endpoint error:', error)

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'AI_INTENT_CALL',
        metadata: {
          intent,
          businessId: targetBusinessId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          continued,
        },
      },
    })

    // Сетевые ошибки gateway => 502
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json({ error: 'AI gateway error' }, { status: 502 })
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

