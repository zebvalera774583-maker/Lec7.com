import 'dotenv/config'
import express from 'express'
import axios from 'axios'
import { Bot } from '@maxhub/max-bot-api'
import { createWorker, OEM } from 'tesseract.js'

const PORT = 3005
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN
const LEC7_BASE_URL = (process.env.LEC7_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const LEC7_MAX_SECRET = process.env.LEC7_MAX_SECRET || ''

if (!MAX_BOT_TOKEN) {
  console.error('MAX_BOT_TOKEN is required')
  process.exit(1)
}

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`max-bot-service listening on port ${PORT}`)
})

const bot = new Bot(MAX_BOT_TOKEN)

/** Безопасное извлечение ключей для debug-лога (без бинарных данных) */
function safeKeys(obj: unknown): string[] {
  if (obj == null || typeof obj !== 'object') return []
  return Object.keys(obj as object)
}

/** Компактный summary для message.link (объект или массив) */
function linkSummary(link: unknown): Record<string, unknown> | null {
  if (link == null) return null
  if (Array.isArray(link)) {
    const first = link[0]
    return {
      type: 'array',
      length: link.length,
      firstElementKeys: first != null && typeof first === 'object' ? safeKeys(first) : [],
    }
  }
  if (typeof link === 'object') {
    const payload = (link as any)?.payload
    const att = (link as any)?.attachments
    return {
      type: 'object',
      linkKeys: safeKeys(link),
      hasType: 'type' in (link as object),
      hasUrl: 'url' in (link as object) || !!(payload?.url ?? (link as any)?.url),
      hasFile: 'file' in (link as object) || !!(payload?.file ?? (link as any)?.file ?? payload?.file_id),
      hasPayload: !!payload,
      payloadKeys: payload ? safeKeys(payload) : [],
      hasAttachments: !!att,
      attachmentsLength: Array.isArray(att) ? att.length : 0,
    }
  }
  return { type: typeof link }
}

/** Debug: сырой update для диагностики изображений */
function logRawUpdate(ctx: any, eventType: string) {
  const u = ctx?.update ?? ctx
  const msg = ctx?.message ?? u?.message
  const body = msg?.body ?? {}
  const attachments = body?.attachments ?? []
  const attPayloads = attachments.map((a: any) => ({
    type: a?.type,
    payloadKeys: a?.payload ? safeKeys(a.payload) : [],
    hasUrl: !!(a?.payload?.url ?? a?.payload?.link),
    hasFile: !!(a?.payload?.file ?? a?.payload?.file_id ?? a?.payload?.id),
  }))
  const link = msg?.link
  const linkSum = linkSummary(link)
  const linkMsg = link?.message
  const linkMsgBody = linkMsg?.body
  const linkMsgAttachments = linkMsgBody?.attachments ?? []
  const linkMsgAttPayloads = linkMsgAttachments.map((a: any) => ({
    type: a?.type,
    payloadKeys: a?.payload ? safeKeys(a.payload) : [],
    hasUrl: !!(a?.payload?.url ?? a?.payload?.link),
    hasFile: !!(a?.payload?.file ?? a?.payload?.file_id ?? a?.payload?.id),
  }))

  const out: Record<string, unknown> = {
    eventType,
    updateKeys: safeKeys(u),
    messageKeys: msg ? safeKeys(msg) : [],
    bodyKeys: safeKeys(body),
    bodyText: typeof body?.text === 'string' ? body.text.slice(0, 80) : body?.text,
    attachmentCount: attachments?.length ?? 0,
    attachmentTypes: attachments?.map((a: any) => a?.type) ?? [],
    attachmentPayloads: attPayloads,
    chatId: ctx?.chatId ?? ctx?.chat?.chat_id ?? msg?.recipient?.chat_id,
    userId: ctx?.user?.user_id ?? msg?.sender?.user_id,
    linkKeys: link != null && typeof link === 'object' && !Array.isArray(link) ? safeKeys(link) : undefined,
    linkSummary: linkSum ?? undefined,
  }
  if (linkMsg != null && typeof linkMsg === 'object') {
    out.linkMessageKeys = safeKeys(linkMsg)
    if (linkMsgBody != null) {
      out.linkMessageBodyKeys = safeKeys(linkMsgBody)
      out.linkMessageBodyText = typeof linkMsgBody?.text === 'string' ? linkMsgBody.text.slice(0, 80) : linkMsgBody?.text
      out.linkMessageAttachmentCount = linkMsgAttachments.length
      out.linkMessageAttachmentTypes = linkMsgAttachments.map((a: any) => a?.type)
      out.linkMessageAttachmentPayloads = linkMsgAttPayloads
    }
  }
  console.log('[MAX raw update]', out)
}

/** OCR: extract text from image buffer (runs locally in Node, no Next.js bundling) */
async function extractTextFromImage(buffer: Buffer): Promise<string> {
  console.log('[OCR] start')
  const worker = await createWorker('rus+eng', OEM.LSTM_ONLY, { logger: () => {} })
  try {
    const imageInput = `data:image/png;base64,${buffer.toString('base64')}`
    const { data } = await worker.recognize(imageInput)
    const text = data.text?.trim() ?? ''
    console.log('[OCR] success')
    return text
  } finally {
    await worker.terminate()
  }
}

type WebhookResponse = {
  replyText?: string
  replyInlineKeyboard?: {
    buttons?: { text: string; callback_data: string }[]
    rows?: { text: string; callback_data: string }[][]
  }
}

async function forwardToWebhook(
  chatId: string | number,
  userId: string | number | undefined,
  text: string,
  choice?: string,
  messageId?: string,
  ts?: string,
  source?: 'ocr'
) {
  const payload: Record<string, unknown> = { chatId, userId, text, messageId, ts, choice }
  if (source) payload.source = source
  const { data } = await axios.post<WebhookResponse>(
    `${LEC7_BASE_URL}/api/integrations/max/webhook`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'X-LEC7-MAX-SECRET': LEC7_MAX_SECRET,
      },
      timeout: 15000,
    }
  )
  return data
}

// MAX API format: attachments with type inline_keyboard, payload.buttons (not reply_markup)
function sendReply(ctx: any, replyText: string, replyInlineKeyboard?: WebhookResponse['replyInlineKeyboard']) {
  if (replyInlineKeyboard?.rows?.length) {
    const buttons = replyInlineKeyboard.rows.map((row) =>
      row.map((btn) => ({ type: 'callback' as const, text: btn.text, payload: btn.callback_data }))
    )
    return ctx.reply(replyText, {
      attachments: [{ type: 'inline_keyboard', payload: { buttons } }],
    })
  }
  if (replyInlineKeyboard?.buttons?.length) {
    const buttons = [
      replyInlineKeyboard.buttons.map((btn) => ({
        type: 'callback' as const,
        text: btn.text,
        payload: btn.callback_data,
      })),
    ]
    return ctx.reply(replyText, {
      attachments: [{ type: 'inline_keyboard', payload: { buttons } }],
    })
  }
  return ctx.reply(replyText)
}

bot.on('message_callback', async (ctx: any) => {
  const payload = ctx.update?.callback?.payload ?? ctx.callbackQuery?.data
  const chatId = ctx.chatId ?? ctx.chat?.chat_id ?? ctx.message?.recipient?.chat_id
  const userId = ctx.user?.user_id ?? ctx.update?.callback?.user?.user_id

  if (!payload || !chatId) return

  console.log('[MAX callback]', { chatId, userId, choice: payload })

  try {
    const data = await forwardToWebhook(
      String(chatId),
      userId != null ? String(userId) : undefined,
      '',
      payload,
      undefined,
      undefined
    )
    const replyText = data?.replyText ?? 'Спасибо, заявка принята'
    try {
      await ctx.answerOnCallback?.({ notification: replyText })
    } catch (e) {
      console.warn('[MAX] answerOnCallback error:', e)
    }
    await sendReply(ctx, replyText, data?.replyInlineKeyboard)
    console.log('[MAX outgoing]', { chatId, replyText: replyText.slice(0, 50) })
  } catch (err: any) {
    const msg = err?.response?.data?.error ?? err?.message ?? 'Ошибка'
    console.error('[MAX error]', msg)
    await ctx.reply('Произошла ошибка. Попробуйте позже.')
  }
})

bot.on('message_created', async (ctx: any) => {
  logRawUpdate(ctx, 'message_created')

  const body = ctx.message?.body
  const text = body?.text
  const bodyAttachments = body?.attachments as { type?: string; payload?: { url?: string; link?: string } }[] | undefined
  const linkMsgAttachments = ctx.message?.link?.message?.attachments as
    | { type?: string; payload?: { url?: string; link?: string } }[]
    | undefined

  const chatId = ctx.chatId ?? ctx.chat?.chat_id ?? ctx.message?.recipient?.chat_id
  const userId = ctx.user?.user_id ?? ctx.message?.sender?.user_id
  const messageId = ctx.messageId ?? ctx.message?.body?.mid
  const ts = ctx.message?.created_at ?? new Date().toISOString()

  let messageText = typeof text === 'string' ? text : ''
  let useOcrSource = false
  let attachmentSource: 'body.attachments' | 'link.message.attachments' | undefined

  // Поиск image: primary = body.attachments, fallback = link.message.attachments
  let imageAtt: { type?: string; payload?: { url?: string; link?: string } } | undefined
  if (Array.isArray(bodyAttachments) && bodyAttachments.length > 0) {
    imageAtt = bodyAttachments.find((a) => a?.type === 'image')
    if (imageAtt) attachmentSource = 'body.attachments'
  }
  if (!imageAtt && Array.isArray(linkMsgAttachments) && linkMsgAttachments.length > 0) {
    imageAtt = linkMsgAttachments.find((a) => a?.type === 'image')
    if (imageAtt) attachmentSource = 'link.message.attachments'
  }

  // Обработка изображений (attachments) — OCR (локально в max-bot, без Lec7 API)
  if (!messageText.trim() && imageAtt) {
    const url = imageAtt?.payload?.url ?? imageAtt?.payload?.link
    if (url) {
      try {
        const imgRes = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 })
        const buffer = Buffer.from(imgRes.data)
        messageText = await extractTextFromImage(buffer)
        if (messageText) useOcrSource = true
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.log('[OCR] fail:', msg)
      }
    }
  }

  if (attachmentSource) {
    console.log('[MAX image attachment]', { attachmentSource })
  }

  if (!messageText.trim()) return

  console.log('[MAX incoming]', { chatId, userId, text: messageText.slice(0, 50), ocr: useOcrSource })

  try {
    const data = await forwardToWebhook(
      chatId,
      userId,
      messageText,
      undefined,
      messageId,
      ts,
      useOcrSource ? 'ocr' : undefined
    )

    const replyText = data?.replyText ?? 'Спасибо, заявка принята'
    await sendReply(ctx, replyText, data?.replyInlineKeyboard)
    console.log('[MAX outgoing]', { chatId, replyText: replyText.slice(0, 50) })
  } catch (err: any) {
    const msg = err?.response?.data?.error ?? err?.message ?? 'Ошибка'
    console.error('[MAX error]', msg)
    await ctx.reply('Произошла ошибка. Попробуйте позже.')
  }
})

bot.catch((err) => {
  console.error('[MAX bot error]', err)
  process.exit(1)
})

bot.on('message_constructed', (ctx: any) => {
  logRawUpdate(ctx, 'message_constructed')
})

bot.on('message_construction_request', (ctx: any) => {
  logRawUpdate(ctx, 'message_construction_request')
})

bot.start()
