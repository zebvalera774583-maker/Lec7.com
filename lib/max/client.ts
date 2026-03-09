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
