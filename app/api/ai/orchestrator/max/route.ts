import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseMaxRequestToRows } from '@/lib/parseMaxRequest'
import { resolveCatalogItems } from '@/lib/orchestrator/resolveCatalogItems'

const SECRET_HEADER = 'x-lec7-max-secret'

/**
 * Найти businessId по externalChatId/chatId.
 * MAX: MaxChatContext (chatId → businessId)
 * Telegram: BusinessTelegramRecipient (chatId → businessId)
 */
async function getBusinessIdByChatId(chatId: string): Promise<string | null> {
  const maxCtx = await prisma.maxChatContext.findUnique({
    where: { chatId },
    select: { businessId: true },
  })
  if (maxCtx) return maxCtx.businessId

  const tgRecipient = await prisma.businessTelegramRecipient.findFirst({
    where: { chatId, isActive: true },
    select: { businessId: true },
  })
  if (tgRecipient) return tgRecipient.businessId

  return null
}

/**
 * POST /api/ai/orchestrator/max
 * Вход для MAX/Telegram — без cookie.
 *
 * Body: { externalChatId или chatId, message }
 * businessId только из привязки (MaxChatContext / BusinessTelegramRecipient)
 * Pipeline: normalize → parseMaxRequestToRows → resolveCatalogItems
 */
export async function POST(request: NextRequest) {
  const expectedSecret = process.env.LEC7_MAX_SECRET
  if (expectedSecret) {
    const incoming = request.headers.get(SECRET_HEADER)
    if (incoming !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: { externalChatId?: unknown; chatId?: unknown; message?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const chatId =
    body?.externalChatId != null ? String(body.externalChatId) : body?.chatId != null ? String(body.chatId) : null
  const message = typeof body?.message === 'string' ? body.message : ''

  if (!chatId) {
    return NextResponse.json({ error: 'externalChatId or chatId required' }, { status: 400 })
  }

  const businessId = await getBusinessIdByChatId(chatId)
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const items = parseMaxRequestToRows(message, '')
  const isFallback =
    items.length === 1 &&
    items[0].name === message.trim() &&
    items[0].quantity === '1' &&
    items[0].unit === 'шт'

  if (items.length > 0 && !isFallback) {
    const resolved = await resolveCatalogItems(items, businessId)

    return NextResponse.json({
      intent: 'create_needs',
      items: resolved.map((r) => ({
        catalogItemId: r.catalogItemId,
        canonicalName: r.canonicalName,
        confidence: r.confidence,
        needsUserChoice: r.needsUserChoice,
        name: r.name,
        quantity: r.quantity,
        unit: r.unit,
      })),
    })
  }

  return NextResponse.json({
    intent: 'unknown',
    message: 'AI Orchestrator MVP active',
    echo: message,
  })
}
