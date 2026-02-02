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
