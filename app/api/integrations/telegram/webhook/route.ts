import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleBotEvent } from '@/lib/bot-core/handleBotEvent'
import { recognizeImage } from '@/lib/ai/yandexVisionOCR'
import { normalizeOrderText } from '@/lib/ai/yandexNormalizeOrder'
import { postProcessTableRows } from '@/lib/ocr/orderImage'

const SECRET_HEADER = 'x-telegram-bot-api-secret-token'
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
  replyInlineKeyboard?: { buttons?: { text: string; callback_data: string }[]; rows?: { text: string; callback_data: string }[][] },
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
    if (!res.ok) {
      console.error('[tg] sendMessage error:', await res.text())
    }
  } catch (e) {
    console.error('[tg] sendMessage exception:', e)
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret) {
    const incoming = req.headers.get(SECRET_HEADER)
    if (incoming !== secret) {
      console.warn('[tg] webhook: secret mismatch (expected header x-telegram-bot-api-secret-token)')
      return NextResponse.json({ ok: false }, { status: 401 })
    }
  }

  let body: {
    message?: {
      text?: string
      photo?: { file_id: string; width: number; height: number }[]
      chat?: { id?: number }
      from?: { id?: number; username?: string }
    }
    callback_query?: { data?: string; message?: { chat?: { id?: number } }; from?: { id?: number; username?: string }; id?: string }
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const hasCallback = !!body?.callback_query
  const hasMessage = !!body?.message?.text
  if (hasCallback || hasMessage) {
    console.log('[tg] webhook received:', hasCallback ? 'callback' : 'message', hasMessage ? body?.message?.text?.slice(0, 50) : '')
  }

  // 1) Callback (кнопки Да/Нет, подразделение)
  const callbackQuery = body?.callback_query
  if (callbackQuery) {
    const callbackData = callbackQuery.data
    const chatId = callbackQuery.message?.chat?.id
    const callbackQueryId = callbackQuery.id
    if (!chatId) return NextResponse.json({ ok: true })
    const isYesNo = callbackData === 'YES' || callbackData === 'NO'
    const isSetDept = typeof callbackData === 'string' && callbackData.startsWith('set_department|')
    if (!isYesNo && !isSetDept) return NextResponse.json({ ok: true })

    if (callbackQueryId) {
      await answerCallbackQuery(callbackQueryId)
    }
    const event = {
      channel: 'telegram' as const,
      chatId: String(chatId),
      userId: callbackQuery.from?.id != null ? String(callbackQuery.from.id) : undefined,
      username: callbackQuery.from?.username,
      text: '',
      choice: callbackData,
      raw: body,
    }
    const { messages, replyInlineKeyboard, removeKeyboard } = await handleBotEvent(event)
    for (let i = 0; i < messages.length; i++) {
      await sendTelegramMessage(String(chatId), messages[i], i === 0 ? replyInlineKeyboard : undefined, i === 0 ? removeKeyboard : undefined)
    }
    return NextResponse.json({ ok: true })
  }

  // 2) Обычное сообщение
  const text = body?.message?.text?.trim()
  const chatId = body?.message?.chat?.id
  const photos = body?.message?.photo

  if (chatId == null) return NextResponse.json({ ok: true })

  // 2a) Фото — OCR (Yandex Vision) и handleBotEvent с source:'ocr'
  if (photos?.length) {
    const largest = photos[photos.length - 1]
    const fileId = largest?.file_id
    if (fileId) {
      try {
        const token = process.env.TELEGRAM_BOT_TOKEN
        if (!token) {
          await sendTelegramMessage(String(chatId), 'OCR недоступен: TELEGRAM_BOT_TOKEN не настроен')
          return NextResponse.json({ ok: true })
        }
        const getFileRes = await fetch(`${TELEGRAM_API}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`)
        const getFileJson = await getFileRes.json()
        const filePath = getFileJson?.result?.file_path
        if (!filePath) {
          await sendTelegramMessage(String(chatId), 'Не удалось получить файл изображения.')
          return NextResponse.json({ ok: true })
        }
        const fileUrl = `${TELEGRAM_API}/file/bot${token}/${filePath}`
        const imgRes = await fetch(fileUrl)
        const arrayBuffer = await imgRes.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const ocrText = await recognizeImage(buffer)
        console.log('[OCR TEXT]', ocrText)

        if (!ocrText.trim()) {
          await sendTelegramMessage(String(chatId), 'Не удалось распознать заявку, попробуйте отправить фото лучше или текстом.')
          return NextResponse.json({ ok: true })
        }

        const lines = ocrText.split(/\n/).map((l) => l.trim()).filter(Boolean)
        const processedLines = lines.length > 1 ? postProcessTableRows(lines) : lines
        const textForNormalize = processedLines.join('\n')
        const normalizedText = await normalizeOrderText(textForNormalize)
        const textForBot = normalizedText.trim() || textForNormalize
        console.log('[NORMALIZED ORDER TEXT]', textForBot)

        const event = {
          channel: 'telegram' as const,
          chatId: String(chatId),
          userId: body?.message?.from?.id != null ? String(body.message.from.id) : undefined,
          username: body?.message?.from?.username,
          text: textForBot,
          source: 'ocr' as const,
          raw: body,
        }
        const { messages, replyInlineKeyboard, removeKeyboard } = await handleBotEvent(event)
        for (let i = 0; i < messages.length; i++) {
          await sendTelegramMessage(String(chatId), messages[i], i === 0 ? replyInlineKeyboard : undefined, i === 0 ? removeKeyboard : undefined)
        }
      } catch (err) {
        console.error('[tg] OCR error:', err)
        await sendTelegramMessage(String(chatId), 'Ошибка при распознавании изображения.')
      }
      return NextResponse.json({ ok: true })
    }
  }

  if (!text) return NextResponse.json({ ok: true })

  // 2b) /start с токеном — привязка чата к бизнесу
  const match = /^\/start\s+(.+)$/.exec(text)
  const token = match?.[1]?.trim()
  if (token) {
    try {
      const row = await prisma.telegramConnectToken.findUnique({
        where: { token },
        select: { id: true, businessId: true, expiresAt: true, usedAt: true, mode: true, label: true },
      })

      if (!row || row.usedAt || new Date() > row.expiresAt) {
        return NextResponse.json({ ok: true })
      }

      const chatIdStr = String(chatId)
      const now = new Date()
      const mode = (row.mode ?? 'set_primary') as string

      if (mode === 'add_recipient') {
        await prisma.$transaction([
          prisma.businessTelegramRecipient.upsert({
            where: {
              businessId_chatId: { businessId: row.businessId, chatId: chatIdStr },
            },
            create: {
              businessId: row.businessId,
              chatId: chatIdStr,
              label: row.label ?? null,
              isActive: true,
            },
            update: {
              label: row.label ?? undefined,
              isActive: true,
            },
          }),
          prisma.telegramConnectToken.update({
            where: { id: row.id },
            data: { usedAt: now },
          }),
        ])
      } else {
        await prisma.$transaction([
          prisma.business.updateMany({
            where: { telegramChatId: chatIdStr, id: { not: row.businessId } },
            data: { telegramChatId: null, telegramConnectedAt: null },
          }),
          prisma.business.update({
            where: { id: row.businessId },
            data: { telegramChatId: chatIdStr, telegramConnectedAt: now },
          }),
          prisma.telegramConnectToken.update({
            where: { id: row.id },
            data: { usedAt: now },
          }),
        ])
      }
      return NextResponse.json({ ok: true })
    } catch (error) {
      console.error('Telegram webhook error (connect):', error)
      return NextResponse.json({ ok: true })
    }
  }

  // 2c) Остальные сообщения — handleBotEvent (потребности, кнопки)
  try {
    const event = {
      channel: 'telegram' as const,
      chatId: String(chatId),
      userId: body?.message?.from?.id != null ? String(body.message.from.id) : undefined,
      username: body?.message?.from?.username,
      text: text,
      raw: body,
    }
    const { messages, replyInlineKeyboard, removeKeyboard } = await handleBotEvent(event)
    for (let i = 0; i < messages.length; i++) {
      await sendTelegramMessage(String(chatId), messages[i], i === 0 ? replyInlineKeyboard : undefined, i === 0 ? removeKeyboard : undefined)
    }
  } catch (error) {
    console.error('Telegram webhook error (handleBotEvent):', error)
  }
  return NextResponse.json({ ok: true })
}
