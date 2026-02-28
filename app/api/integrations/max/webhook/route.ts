import { NextRequest, NextResponse } from 'next/server'
import { handleBotEvent } from '@/lib/bot-core/handleBotEvent'

const SECRET_HEADER = 'x-lec7-max-secret'

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.LEC7_MAX_SECRET
  if (expectedSecret) {
    const incoming = req.headers.get(SECRET_HEADER)
    if (incoming !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: { chatId?: unknown; userId?: unknown; text?: string; messageId?: unknown; choice?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const chatId = body?.chatId != null ? String(body.chatId) : null
  const text = typeof body?.text === 'string' ? body.text : ''
  const choice = body?.choice === 'YES' || body?.choice === 'NO' ? body.choice : undefined

  if (!chatId) {
    return NextResponse.json({ replyText: 'Ошибка: chatId отсутствует' })
  }

  const event = {
    channel: 'max' as const,
    chatId,
    userId: body?.userId != null ? String(body.userId) : undefined,
    username: undefined,
    text: text.trim() || '',
    choice,
    raw: body,
  }

  try {
    const { messages, replyInlineKeyboard } = await handleBotEvent(event)
    const replyText = messages.length > 0 ? messages.join('\n') : 'Спасибо, заявка принята'
    return NextResponse.json({ replyText, replyInlineKeyboard })
  } catch (e) {
    console.error('[MAX webhook error]', e)
    return NextResponse.json({ replyText: 'Произошла ошибка. Попробуйте позже.' })
  }
}
