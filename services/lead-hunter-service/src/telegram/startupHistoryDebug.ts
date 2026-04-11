import type { TelegramClient } from 'telegram'
import { Api, utils } from 'telegram'

/**
 * Одноразовый debug: последние 10 сообщений из самого свежего диалога (GetDialogs + GetHistory).
 */
export async function logLastTelegramMessagesOnStartup(client: TelegramClient): Promise<void> {
  try {
    const dialogs = await client.getDialogs({ limit: 1 })
    if (!dialogs.length) {
      console.log('[telegram-history] no dialogs')
      return
    }
    const d = dialogs[0]
    const entity = d.entity ?? d.inputEntity
    const rows = await client.getMessages(entity, { limit: 10 })

    for (const msg of rows) {
      if (msg instanceof Api.MessageEmpty) continue

      const chatId = String(utils.getPeerId(msg.peerId))
      const senderId = msg.senderId != null ? String(msg.senderId) : ''
      const raw = typeof msg.message === 'string' ? msg.message : ''
      const textForLog = raw.length > 0 ? raw : '(no text)'

      console.log('[telegram-history] message')
      console.log(`  chatId=${chatId}`)
      console.log(`  senderId=${senderId}`)
      console.log(`  text=${JSON.stringify(textForLog)}`)
    }
  } catch (e) {
    console.error('[telegram-history] error:', e instanceof Error ? e.message : e)
  }
}
