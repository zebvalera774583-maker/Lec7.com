/**
 * Уведомление владельцу после создания заявки из бота.
 * Канал (MAX/Telegram) определяет, куда отправить.
 */

import { sendMessage as sendMaxMessage } from '@/lib/max/client'
import { sendTelegramMessage } from '@/lib/telegram'

const ADMIN_MAX_CHAT_ID = '208922838'
const ADMIN_TELEGRAM_CHAT_ID = process.env.ADMIN_TG_CHAT_ID?.trim() || ''

const TELEGRAM_MESSAGE_MAX = 4096
const RAW_MIRROR_SAFE_LEN = 3500

function truncateTelegramText(s: string): string {
  if (s.length <= TELEGRAM_MESSAGE_MAX) return s
  return `${s.slice(0, RAW_MIRROR_SAFE_LEN)}\n\n… (обрезано)`
}

/**
 * Копия сырого текстового входа заявки в личный чат администратора.
 * Telegram → Telegram; MAX → MAX (тот же чат, что в notifyAdminAboutRequest).
 * Только для диагностики; не блокирует обработку. Пустой rawText — не отправлять.
 */
export async function mirrorRawIncomingOrderToAdmin(params: {
  channel: 'telegram' | 'max'
  chatId: string
  userId?: string
  username?: string
  rawText: string
}): Promise<void> {
  const raw = params.rawText
  if (raw == null || String(raw).trim() === '') return

  const userLabel =
    params.username != null && String(params.username).trim() !== '' ? String(params.username).trim() : '—'
  const headerLines = [
    'RAW ЗАЯВКА',
    `Канал: ${params.channel}`,
    `Chat ID: ${params.chatId}`,
    `User ID: ${params.userId ?? '—'}`,
    `Username: ${userLabel}`,
    'Текст:',
  ].join('\n')

  const full = `${headerLines}\n${raw}`
  const text = truncateTelegramText(full)

  if (params.channel === 'max') {
    const res = await sendMaxMessage(ADMIN_MAX_CHAT_ID, text, undefined, 'chat_id')
    if (!res.ok) {
      throw new Error(`mirrorRawIncomingOrderToAdmin: sendMaxMessage failed: ${res.error ?? 'unknown'}`)
    }
    return
  }

  const targetChat =
    process.env.ADMIN_TELEGRAM_RAW_MIRROR_CHAT_ID?.trim() || ADMIN_TELEGRAM_CHAT_ID

  if (!targetChat.trim()) {
    console.warn(
      '[mirrorRawIncomingOrderToAdmin] Telegram admin chat id is missing (set ADMIN_TG_CHAT_ID or ADMIN_TELEGRAM_RAW_MIRROR_CHAT_ID)'
    )
    return
  }

  const ok = await sendTelegramMessage(targetChat, text)
  if (!ok) {
    throw new Error('mirrorRawIncomingOrderToAdmin: sendTelegramMessage returned false')
  }
}

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
      if (!ADMIN_TELEGRAM_CHAT_ID) {
        console.warn('[notifyAdmin] ADMIN_TG_CHAT_ID is missing')
      } else {
        await sendTelegramMessage(ADMIN_TELEGRAM_CHAT_ID, text)
      }
    }
  } catch (e) {
    console.warn('[notifyAdmin] send error:', e)
  }
}
