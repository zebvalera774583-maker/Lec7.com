/**
 * MAX client for sending messages.
 * Endpoint and token from env: MAX_API_URL, MAX_BOT_TOKEN.
 */

const MAX_API_URL = process.env.MAX_API_URL || 'https://botapi.max.ru'
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN || ''

export interface SendMessageResult {
  ok: boolean
  error?: string
}

export interface InlineKeyboardButton {
  text: string
  callback_data: string
}

/**
 * Send message to MAX chat.
 * If replyInlineKeyboard is provided, adds attachments with inline_keyboard (2 buttons Да/Нет as callback).
 * MAX API format: attachments: [{ type: 'inline_keyboard', payload: { buttons: [[{ type:'callback', text, payload }]] } }]
 * Returns { ok: true } on success, { ok: false, error } on failure.
 */
export async function sendMessage(
  chatId: string,
  text: string,
  replyInlineKeyboard?: { buttons: InlineKeyboardButton[] }
): Promise<SendMessageResult> {
  if (!MAX_BOT_TOKEN) {
    console.warn('[max/client] MAX_BOT_TOKEN not configured, skip send')
    return { ok: false, error: 'MAX_BOT_TOKEN not configured' }
  }

  try {
    const url = `${MAX_API_URL.replace(/\/$/, '')}/chats/${chatId}/messages`
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
        Authorization: `Bearer ${MAX_BOT_TOKEN}`,
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
