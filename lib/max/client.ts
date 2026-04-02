/**
 * MAX client for sending messages.
 * API: https://dev.max.ru/docs-api/methods/POST/messages
 * Endpoint: POST /messages?user_id={id} (or ?chat_id={id})
 * Base URL from env: MAX_API_URL (default platform-api.max.ru)
 */

const MAX_API_URL = process.env.MAX_API_URL || 'https://platform-api.max.ru'
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN || ''

export interface SendMessageResult {
  ok: boolean
  error?: string
}

export interface InlineKeyboardButton {
  text: string
  callback_data: string
}

export type MaxRecipientType = 'user_id' | 'chat_id'

/**
 * Send message to MAX. recipientId + recipientType: user_id (direct) or chat_id (group).
 * MAX API: POST /messages?user_id={id} или ?chat_id={id}
 */
export async function sendMessage(
  recipientId: string,
  text: string,
  replyInlineKeyboard?: { buttons: InlineKeyboardButton[] },
  recipientType: MaxRecipientType = 'user_id'
): Promise<SendMessageResult> {
  if (!MAX_BOT_TOKEN) {
    console.warn('[max/client] MAX_BOT_TOKEN not configured, skip send')
    return { ok: false, error: 'MAX_BOT_TOKEN not configured' }
  }

  try {
    const base = MAX_API_URL.replace(/\/$/, '')
    const param = recipientType === 'chat_id' ? 'chat_id' : 'user_id'
    const url = `${base}/messages?${param}=${encodeURIComponent(recipientId)}`
    console.log('[max/client] POST', url)
    const body: {
      text: string
      attachments?: Array<{
        type: 'inline_keyboard'
        payload: {
          buttons: Array<Array<{ type: 'callback'; text: string; payload: string }>>
        }
      }>
    } = { text }

    if (replyInlineKeyboard?.buttons?.length) {
      body.attachments = [
        {
          type: 'inline_keyboard',
          payload: {
            buttons: [
              replyInlineKeyboard.buttons.map((b) => ({
                type: 'callback' as const,
                text: b.text,
                payload: b.callback_data,
              })),
            ],
          },
        },
      ]
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `${MAX_BOT_TOKEN}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      return { ok: false, error: `MAX API ${res.status}: ${errText}` }
    }

    return { ok: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

function extFromMime(mimeType: string | undefined): string | null {
  const m = (mimeType ?? '').toLowerCase()
  if (m.includes('png')) return '.png'
  if (m.includes('webp')) return '.webp'
  if (m.includes('gif')) return '.gif'
  if (m.includes('jpeg') || m.includes('jpg')) return '.jpg'
  return null
}

function safeMirrorFileName(fileName: string | undefined, mimeType: string | undefined, imageUrl: string): string {
  const trimmed = fileName?.trim()
  if (trimmed) {
    const t = trimmed.replace(/[/\\]/g, '_')
    return t.length > 200 ? `${t.slice(0, 200)}` : t
  }
  const fromUrl = (() => {
    try {
      const u = new URL(imageUrl)
      const base = u.pathname.split('/').pop() ?? ''
      if (/\.(jpe?g|png|gif|webp)$/i.test(base)) return base.slice(0, 200)
    } catch {
      /* ignore */
    }
    return null
  })()
  if (fromUrl) return fromUrl
  return `mirror${extFromMime(mimeType) ?? '.jpg'}`
}

/**
 * Скачивает изображение по URL, загружает в MAX (POST /uploads?type=image + multipart на выданный URL),
 * отправляет сообщение с вложением type=image (payload с token из ответа загрузки).
 */
export async function sendMessageWithImageFromUrl(
  recipientId: string,
  text: string,
  imageUrl: string,
  recipientType: MaxRecipientType = 'user_id',
  options?: { fileName?: string; mimeType?: string }
): Promise<SendMessageResult> {
  if (!MAX_BOT_TOKEN) {
    console.warn('[max/client] MAX_BOT_TOKEN not configured, skip send')
    return { ok: false, error: 'MAX_BOT_TOKEN not configured' }
  }

  let buffer: Buffer
  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(45000) })
    if (!imgRes.ok) {
      return { ok: false, error: `image fetch HTTP ${imgRes.status}` }
    }
    buffer = Buffer.from(await imgRes.arrayBuffer())
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `image fetch: ${msg}` }
  }

  const fileName = safeMirrorFileName(options?.fileName, options?.mimeType, imageUrl)

  try {
    const base = MAX_API_URL.replace(/\/$/, '')
    const initRes = await fetch(`${base}/uploads?type=image`, {
      method: 'POST',
      headers: { Authorization: MAX_BOT_TOKEN },
    })
    if (!initRes.ok) {
      const errText = await initRes.text()
      return { ok: false, error: `uploads init ${initRes.status}: ${errText}` }
    }
    const initJson = (await initRes.json()) as { url?: string }
    const uploadUrl = initJson.url
    if (!uploadUrl) {
      return { ok: false, error: 'uploads response missing url' }
    }

    const form = new FormData()
    form.append('data', new Blob([new Uint8Array(buffer)]), fileName)

    const upRes = await fetch(uploadUrl, { method: 'POST', body: form })
    if (!upRes.ok) {
      const errText = await upRes.text()
      return { ok: false, error: `upload binary ${upRes.status}: ${errText}` }
    }
    const upJson = (await upRes.json()) as { token?: string }
    console.log('[max/client] MAX image upload response (full JSON):', JSON.stringify(upJson, null, 2))
    const token = upJson.token
    if (!token) {
      return { ok: false, error: `upload response missing token: ${JSON.stringify(upJson)}` }
    }

    await new Promise((r) => setTimeout(r, 400))

    const param = recipientType === 'chat_id' ? 'chat_id' : 'user_id'
    const msgUrl = `${base}/messages?${param}=${encodeURIComponent(recipientId)}`
    const body = {
      text,
      attachments: [{ type: 'image' as const, payload: { token } }],
    }

    const res = await fetch(msgUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: MAX_BOT_TOKEN,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      return { ok: false, error: `MAX API ${res.status}: ${errText}` }
    }

    return { ok: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
