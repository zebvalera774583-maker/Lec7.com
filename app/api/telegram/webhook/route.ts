import { NextRequest, NextResponse } from 'next/server'
import { handleBotEvent } from '@/lib/bot-core/handleBotEvent'

const TELEGRAM_API = 'https://api.telegram.org'

async function sendTelegramMessage(
  chatId: string,
  text: string,
  replyMarkup?: { keyboard: string[][]; resize_keyboard?: boolean; one_time_keyboard?: boolean }
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN not set')
    return
  }
  try {
    const body: { chat_id: string; text: string; reply_markup?: object } = { chat_id: chatId, text }
    if (replyMarkup) {
      body.reply_markup = replyMarkup
    }
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    console.log('[tg] sendMessage status:', res.status)
    if (!res.ok) {
      console.error('[tg] sendMessage error:', await res.text())
    }
  } catch (e) {
    console.error('[tg] sendMessage exception:', e)
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

    const { messages, replyMarkup } = await handleBotEvent(event)

    console.log('[tg] reply messages:', messages)

    for (let i = 0; i < messages.length; i++) {
      await sendTelegramMessage(String(chatId), messages[i], i === 0 ? replyMarkup : undefined)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Telegram webhook error:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
