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
  console.log('[notifyAdmin] entry', { channel, department, number, itemsCount })
  const text = `🔔 Заявка отправлена

От: ${department}
Номер: ${number}
Позиций: ${itemsCount}`

  try {
    if (channel === 'max') {
      console.log('[notifyAdmin] sending to MAX', { chatId: ADMIN_MAX_CHAT_ID, hasToken: !!process.env.MAX_BOT_TOKEN })
      const res = await sendMaxMessage(ADMIN_MAX_CHAT_ID, text, undefined, 'chat_id')
      if (res.ok) {
        console.log('[notifyAdmin] MAX send OK')
      } else {
        console.warn('[notifyAdmin] MAX send failed:', res.error)
      }
    } else {
      await sendTelegramMessage(ADMIN_TELEGRAM_CHAT_ID, text)
    }
  } catch (e) {
    console.warn('[notifyAdmin] send error:', e)
  }
}
