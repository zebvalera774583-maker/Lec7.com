/**
 * MAX client for sending messages.
 * Endpoint and token from env: MAX_API_URL, MAX_BOT_TOKEN or similar.
 */

const MAX_API_URL = process.env.MAX_API_URL || ''
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN || ''

export interface SendMessageResult {
  ok: boolean
  error?: string
}

/**
 * Send message to MAX chat.
 * Returns { ok: true } on success, { ok: false, error } on failure.
 * Note: The max-bot-service typically handles replies via webhook response (replyText).
 * This client is for direct API calls when needed.
 */
export async function sendMessage(chatId: string, text: string): Promise<SendMessageResult> {
  if (!MAX_API_URL || !MAX_BOT_TOKEN) {
    return { ok: false, error: 'MAX_API_URL or MAX_BOT_TOKEN not configured' }
  }

  try {
    const url = `${MAX_API_URL.replace(/\/$/, '')}/chats/${chatId}/messages`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MAX_BOT_TOKEN}`,
      },
      body: JSON.stringify({ text }),
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
