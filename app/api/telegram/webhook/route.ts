import { NextRequest, NextResponse } from 'next/server'
import { handleBotEvent } from '@/lib/bot-core/handleBotEvent'

const TELEGRAM_API = 'https://api.telegram.org'

async function answerCallbackQuery(callbackQueryId: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    })
  } catch (e) {
    console.error('[tg] answerCallbackQuery exception:', e)
  }
}

async function sendTelegramMessage(
  chatId: string,
  text: string,
  replyInlineKeyboard?: { buttons: { text: string; callback_data: string }[] },
  removeKeyboard?: boolean
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN not set')
    return
  }
  try {
    const body: { chat_id: string; text: string; reply_markup?: object } = { chat_id: chatId, text }
    if (removeKeyboard) {
      body.reply_markup = { remove_keyboard: true }
    } else if (replyInlineKeyboard?.rows?.length) {
      body.reply_markup = {
        inline_keyboard: replyInlineKeyboard.rows.map((row) =>
          row.map((b) => ({ text: b.text, callback_data: b.callback_data }))
        ),
      }
    } else if (replyInlineKeyboard?.buttons?.length) {
      body.reply_markup = {
        inline_keyboard: [replyInlineKeyboard.buttons.map((b) => ({ text: b.text, callback_data: b.callback_data }))],
      }
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

    const callbackQuery = body?.callback_query
    if (callbackQuery) {
      const callbackData = callbackQuery.data
      const chatId = callbackQuery.message?.chat?.id
      const from = callbackQuery.from
      const callbackQueryId = callbackQuery.id

      if (!chatId) return NextResponse.json({ ok: true })
      const isYesNo = callbackData === 'YES' || callbackData === 'NO'
      const isSetDept = typeof callbackData === 'string' && callbackData.startsWith('set_department|')
      if (!isYesNo && !isSetDept) return NextResponse.json({ ok: true })

      await answerCallbackQuery(callbackQueryId)

      const event = {
        channel: 'telegram' as const,
        chatId: String(chatId),
        userId: from?.id != null ? String(from.id) : undefined,
        username: from?.username,
        text: '',
        choice: callbackData,
        raw: body,
      }

      const { messages, replyInlineKeyboard, removeKeyboard } = await handleBotEvent(event)

      console.log('[tg] reply messages (callback):', messages)

      for (let i = 0; i < messages.length; i++) {
        await sendTelegramMessage(
          String(chatId),
          messages[i],
          i === 0 ? replyInlineKeyboard : undefined,
          i === 0 ? removeKeyboard : undefined
        )
      }

      return NextResponse.json({ ok: true })
    }

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

    const { messages, replyInlineKeyboard, removeKeyboard } = await handleBotEvent(event)

    console.log('[tg] reply messages:', messages)

    for (let i = 0; i < messages.length; i++) {
      await sendTelegramMessage(
        String(chatId),
        messages[i],
        i === 0 ? replyInlineKeyboard : undefined,
        i === 0 ? removeKeyboard : undefined
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Telegram webhook error:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
