/**
 * Уведомление владельцу после создания заявки из бота.
 * Канал (MAX/Telegram) определяет, куда отправить.
 */

import { sendMessage as sendMaxMessage } from '@/lib/max/client'
import { sendTelegramMessage } from '@/lib/telegram'

const ADMIN_MAX_CHAT_ID = '208922838'
const ADMIN_TELEGRAM_CHAT_ID = '5848277'

export async function notifyAdminAboutRequest(
  channel: 'telegram' | 'max',
  department: string,
  number: number,
  itemsCount: number
): Promise<void> {
  const text = `🔔 Заявка отправлена

От: ${department}
Номер: ${number}
Позиций: ${itemsCount}`

  try {
    if (channel === 'max') {
      const res = await sendMaxMessage(ADMIN_MAX_CHAT_ID, text)
      if (!res.ok) {
        console.warn('[notifyAdmin] MAX send failed:', res.error)
      }
    } else {
      await sendTelegramMessage(ADMIN_TELEGRAM_CHAT_ID, text)
    }
  } catch (e) {
    console.warn('[notifyAdmin] send error:', e)
  }
}
