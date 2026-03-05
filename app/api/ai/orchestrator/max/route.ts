import { NextRequest, NextResponse } from 'next/server'
import { recognizeNeedsForChat } from '@/lib/orchestrator/recognizeNeedsForChat'

const SECRET_HEADER = 'x-lec7-max-secret'

/**
 * POST /api/ai/orchestrator/max
 * Вход для MAX/Telegram — без cookie.
 *
 * Body: { externalChatId или chatId, message }
 * businessId из привязки (MaxChatContext / BusinessTelegramRecipient) или BOT_BUSINESS_ID
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

  const result = await recognizeNeedsForChat(chatId, message)

  if (result.intent === 'create_needs' && result.items?.length) {
    return NextResponse.json({
      intent: 'create_needs',
      items: result.items.map((r) => ({
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
