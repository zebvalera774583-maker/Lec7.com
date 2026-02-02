/**
 * Send a text message to a Telegram chat via Bot API.
 * Requires TELEGRAM_BOT_TOKEN in env.
 */
export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN not set, skip sending')
    return false
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.warn('Telegram sendMessage failed:', res.status, err)
      return false
    }
    return true
  } catch (e) {
    console.warn('Telegram sendMessage error:', e)
    return false
  }
}

/**
 * Send a document to a Telegram chat via Bot API (sendDocument).
 * Requires TELEGRAM_BOT_TOKEN in env.
 */
export async function sendTelegramDocument(
  chatId: string,
  filename: string,
  buffer: Buffer,
  caption?: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN not set, skip sending document')
    return
  }
  try {
    const form = new FormData()
    form.append('chat_id', chatId)
    form.append('document', new Blob([new Uint8Array(buffer)]), filename)
    if (caption) form.append('caption', caption)

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) {
      const err = await res.text()
      console.warn('Telegram sendDocument failed:', res.status, err)
    }
  } catch (e) {
    console.warn('Telegram sendDocument error:', e)
  }
}
