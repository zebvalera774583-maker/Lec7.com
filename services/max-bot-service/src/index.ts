import 'dotenv/config'
import express from 'express'
import axios from 'axios'
import { Bot } from '@maxhub/max-bot-api'

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

const YANDEX_OCR_URL = 'https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText'

function extractTextFromYandexResponse(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const obj = data as Record<string, unknown>
  const root = (obj.result ?? obj.textAnnotation ?? obj) as Record<string, unknown> | undefined
  if (!root) return ''
  const directText = root.text
  if (typeof directText === 'string' && directText.trim()) return directText.trim()
  const blocks = root.blocks as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(blocks)) return ''
  const lines: string[] = []
  for (const block of blocks) {
    const blockLines = block.lines as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(blockLines)) continue
    for (const line of blockLines) {
      const text = line.text
      if (typeof text === 'string' && text.trim()) lines.push(text.trim())
    }
  }
  return lines.join('\n')
}

const VALID_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp']

function parseMimeFromContentType(contentType: string | undefined): string {
  if (!contentType || typeof contentType !== 'string') return 'image/jpeg'
  const mime = contentType.split(';')[0].trim().toLowerCase()
  return VALID_IMAGE_MIMES.includes(mime) ? mime : 'image/jpeg'
}

/** OCR: Yandex Vision OCR (same as Lec7). Env: YANDEX_API_KEY, YANDEX_FOLDER_ID */
async function recognizeImageWithYandex(buffer: Buffer, mimeType: string = 'image/jpeg'): Promise<string> {
  const apiKey = process.env.YANDEX_API_KEY?.trim()
  const folderId = process.env.YANDEX_FOLDER_ID?.trim()
  if (!apiKey || !folderId) {
    throw new Error('YANDEX_API_KEY and YANDEX_FOLDER_ID are required for Yandex Vision OCR')
  }
  const content = buffer.toString('base64')
  const res = await axios.post(
    YANDEX_OCR_URL,
    { mimeType, languageCodes: ['ru'], model: 'table', content },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Api-Key ${apiKey}`,
        'x-folder-id': folderId,
      },
      timeout: 30000,
    }
  )
  return extractTextFromYandexResponse(res.data)
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
        console.log('[MAX PHOTO] received')
        const imgRes = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 })
        const buffer = Buffer.from(imgRes.data)
        const mimeType = parseMimeFromContentType(imgRes.headers['content-type'])
        console.log('[MAX PHOTO] downloaded bytes=', buffer.length, 'mime=', mimeType)

        const ocrText = await recognizeImageWithYandex(buffer, mimeType)
        console.log('[MAX OCR TEXT]\n', ocrText)

        if (!ocrText.trim()) {
          await sendReply(ctx, 'Не удалось распознать заявку, попробуйте отправить фото лучше или текстом.')
          return
        }

        messageText = ocrText
        useOcrSource = true

        const normalizedText = messageText
        const textForBot = normalizedText
        console.log('[MAX PHOTO] normalizedText=\n', normalizedText)
        console.log('[MAX PHOTO] textForBot=\n', textForBot)
        console.log('[MAX -> handleBotEvent] chatId=', chatId, 'userId=', userId, 'text=', textForBot, 'ocr=true')

        const data = await forwardToWebhook(
          chatId,
          userId,
          textForBot,
          undefined,
          messageId,
          ts,
          'ocr'
        )

        console.log('[handleBotEvent -> MAX]', JSON.stringify(data))

        const replyText = data?.replyText ?? 'Спасибо, заявка принята'
        console.log('[MAX final reply]', replyText)
        await sendReply(ctx, replyText, data?.replyInlineKeyboard)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.log('[OCR] fail:', msg)
        await sendReply(ctx, 'Не удалось распознать заявку, попробуйте отправить фото лучше или текстом.')
        return
      }
      return
    }
  }

  if (attachmentSource) {
    console.log('[MAX image attachment]', { attachmentSource })
  }

  if (!messageText.trim()) return

  console.log('[MAX -> handleBotEvent] chatId=', chatId, 'userId=', userId, 'text=', messageText, 'ocr=', useOcrSource)

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

    console.log('[handleBotEvent -> MAX]', JSON.stringify(data))

    const replyText = data?.replyText ?? 'Спасибо, заявка принята'
    console.log('[MAX final reply]', replyText)
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
