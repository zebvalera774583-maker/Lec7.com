import { NextRequest, NextResponse } from 'next/server'
import { handleBotEvent } from '@/lib/bot-core/handleBotEvent'

const TELEGRAM_API = 'https://api.telegram.org'

async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN not set')
    return
  }
  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('Telegram sendMessage error:', res.status, err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    console.log('Telegram update:', JSON.stringify(body, null, 2))

    const chatId = body?.message?.chat?.id
    const text = body?.message?.text
    const from = body?.message?.from

    if (!text || chatId == null) {
      return NextResponse.json({ ok: true })
    }

    const event = {
      channel: 'telegram' as const,
      chatId: String(chatId),
      userId: from?.id != null ? String(from.id) : undefined,
      username: from?.username,
      text: typeof text === 'string' ? text : String(text),
      raw: body,
    }

    const { messages } = await handleBotEvent(event)

    for (const msg of messages) {
      await sendTelegramMessage(String(chatId), msg)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Telegram webhook error:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
