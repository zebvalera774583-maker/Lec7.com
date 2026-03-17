import { NextRequest, NextResponse } from 'next/server'
import { handleBotEvent } from '@/lib/bot-core/handleBotEvent'
import { cleanOcrTable, normalizeOcrUnits, extractTableItems, postProcessTableRows } from '@/lib/ocr/orderImage'

const SECRET_HEADER = 'x-lec7-max-secret'

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.LEC7_MAX_SECRET
  if (expectedSecret) {
    const incoming = req.headers.get(SECRET_HEADER)
    if (incoming !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: {
    chatId?: unknown
    userId?: unknown
    text?: string
    messageId?: unknown
    choice?: string
    source?: 'ocr' | 'max_photo' | 'max_pdf'
    rawText?: string
    lines?: string[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const chatId = body?.chatId != null ? String(body.chatId) : null
  let text = typeof body?.text === 'string' ? body.text : ''
  if (body?.source === 'max_photo') {
    const rawLines = Array.isArray(body?.lines) && body.lines.length > 0 ? body.lines : (text ? text.split(/\n/) : [])
    const processed = rawLines.length > 0 ? postProcessTableRows(rawLines) : []
    const withQty = processed.filter((line) => /\d/.test(line))
    text = withQty.join('\n')
  } else if (body?.source === 'max_pdf') {
    // text уже приходит в формате "название кол-во ед\n..."
  } else if (body?.source === 'ocr' && text) {
    const cleaned = normalizeOcrUnits(cleanOcrTable(text))
    const rows = cleaned.split(/\n/).filter(Boolean)
    const tableItems = extractTableItems(rows)
    text = tableItems.length > 0 ? tableItems.join('\n') : cleaned
  }
  const choice = typeof body?.choice === 'string' ? body.choice : undefined
  const source: 'ocr' | undefined =
    body?.source === 'ocr' || body?.source === 'max_photo' || body?.source === 'max_pdf' ? 'ocr' : undefined

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
    source,
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
