/**
 * Уведомление владельцу после создания заявки из бота.
 * Канал (MAX/Telegram) определяет, куда отправить.
 */

import { sendMessage as sendMaxMessage, sendMessageWithImageFromUrl } from '@/lib/max/client'
import { sendTelegramMessage, sendTelegramPhoto } from '@/lib/telegram'

const ADMIN_MAX_CHAT_ID = '208922838'
const ADMIN_TELEGRAM_CHAT_ID = process.env.ADMIN_TG_CHAT_ID?.trim() || ''

const TELEGRAM_MESSAGE_MAX = 4096
const RAW_MIRROR_SAFE_LEN = 3500

/** Метаданные вложения MAX (photo/file), приходят из `services/max-bot-service` → webhook JSON. */
export type MaxIncomingAttachmentMeta = {
  type?: string
  mimeType?: string
  fileName?: string
  attachmentSource?: string
  url?: string
}

function maxAttachmentLines(meta: MaxIncomingAttachmentMeta, options?: { omitUrl?: boolean }): string[] {
  const lines: string[] = ['Вложение MAX:']
  if (meta.type) lines.push(`  type: ${meta.type}`)
  if (meta.mimeType) lines.push(`  mimeType: ${meta.mimeType}`)
  if (meta.fileName) lines.push(`  fileName: ${meta.fileName}`)
  if (meta.attachmentSource) lines.push(`  attachmentSource: ${meta.attachmentSource}`)
  if (meta.url && !options?.omitUrl) lines.push(`  url: ${meta.url}`)
  return lines.length > 1 ? lines : []
}

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
  /** Только для MAX: что известно о вложении (фото и т.д.) из payload webhook. */
  maxAttachment?: MaxIncomingAttachmentMeta
}): Promise<void> {
  const raw = params.rawText
  if (raw == null || String(raw).trim() === '') return

  const userLabel =
    params.username != null && String(params.username).trim() !== '' ? String(params.username).trim() : '—'
  const omitUrlInMirrorText =
    params.channel === 'max' &&
    params.maxAttachment?.type === 'image' &&
    Boolean(params.maxAttachment.url?.trim())
  const attBlock =
    params.channel === 'max' && params.maxAttachment
      ? maxAttachmentLines(params.maxAttachment, { omitUrl: omitUrlInMirrorText }).join('\n')
      : ''
  const headerLines = [
    'RAW ЗАЯВКА',
    `Канал: ${params.channel}`,
    `Chat ID: ${params.chatId}`,
    `User ID: ${params.userId ?? '—'}`,
    `Username: ${userLabel}`,
    ...(attBlock ? [attBlock, ''] : []),
    'Текст:',
  ].join('\n')

  const full = `${headerLines}\n${raw}`
  const text = truncateTelegramText(full)

  const mirrorTelegramImageUrl =
    params.maxAttachment?.type === 'image' && params.maxAttachment.url?.trim()
      ? params.maxAttachment.url.trim()
      : null

  if (params.channel === 'max') {
    if (mirrorTelegramImageUrl) {
      const targetChat =
        process.env.ADMIN_TELEGRAM_RAW_MIRROR_CHAT_ID?.trim() || ADMIN_TELEGRAM_CHAT_ID
      if (targetChat.trim()) {
        const okPhoto = await sendTelegramPhoto(targetChat, mirrorTelegramImageUrl, text)
        if (!okPhoto) {
          throw new Error('mirrorRawIncomingOrderToAdmin: sendTelegramPhoto returned false')
        }
      } else {
        console.warn(
          '[mirrorRawIncomingOrderToAdmin] Telegram admin chat id is missing (set ADMIN_TG_CHAT_ID or ADMIN_TELEGRAM_RAW_MIRROR_CHAT_ID) — photo mirror skipped'
        )
      }
    }
    const res = mirrorTelegramImageUrl
      ? await sendMessageWithImageFromUrl(ADMIN_MAX_CHAT_ID, text, mirrorTelegramImageUrl, 'chat_id', {
          fileName: params.maxAttachment?.fileName,
          mimeType: params.maxAttachment?.mimeType,
        })
      : await sendMaxMessage(ADMIN_MAX_CHAT_ID, text, undefined, 'chat_id')
    if (!res.ok) {
      throw new Error(
        `mirrorRawIncomingOrderToAdmin: ${mirrorTelegramImageUrl ? 'sendMessageWithImageFromUrl' : 'sendMaxMessage'} failed: ${res.error ?? 'unknown'}`
      )
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

  if (mirrorTelegramImageUrl) {
    const ok = await sendTelegramPhoto(targetChat, mirrorTelegramImageUrl, text)
    if (!ok) {
      throw new Error('mirrorRawIncomingOrderToAdmin: sendTelegramPhoto returned false')
    }
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
