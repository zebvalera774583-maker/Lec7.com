import { utils } from 'telegram'
import type { NewMessageEvent } from 'telegram/events'
import { appendTestSignal, type TestSignal } from '../testSignalsStore.js'

/** Фразы для поиска в тексте (нижний регистр). */
export const TELEGRAM_LEAD_KEYWORDS = [
  'где заказать',
  'доставка еды',
  'посоветуйте доставку',
  'хочу заказать еду',
  'пицца доставка',
] as const

export function textMatchesTelegramLeadKeywords(text: string): boolean {
  const lower = text.toLowerCase()
  return TELEGRAM_LEAD_KEYWORDS.some((phrase) => lower.includes(phrase))
}

async function resolveChatTitle(event: NewMessageEvent): Promise<string> {
  try {
    const chat = await event.getChat()
    if (!chat) return ''
    if ('title' in chat && chat.title) return String(chat.title)
    if ('firstName' in chat && chat.firstName) {
      const last = 'lastName' in chat && chat.lastName ? String(chat.lastName) : ''
      return [String(chat.firstName), last].filter(Boolean).join(' ').trim()
    }
  } catch {
    /* ignore */
  }
  return ''
}

async function resolveSenderUsername(msg: NewMessageEvent['message']): Promise<string> {
  try {
    const sender = await msg.getSender()
    if (sender && 'username' in sender && sender.username) return String(sender.username)
  } catch {
    /* ignore */
  }
  return ''
}

export async function handleTelegramLeadMessage(event: NewMessageEvent): Promise<void> {
  const msg = event.message
  const textRaw = typeof msg.message === 'string' ? msg.message : ''
  if (!textMatchesTelegramLeadKeywords(textRaw)) return

  const chatId = String(utils.getPeerId(msg.peerId))
  const senderId = msg.senderId != null ? String(msg.senderId) : ''

  console.log('[telegram-hunter] hit')
  console.log(`  chatId=${chatId}`)
  console.log(`  senderId=${senderId}`)
  console.log(`  text=${JSON.stringify(textRaw)}`)

  const [chatTitle, username] = await Promise.all([
    resolveChatTitle(event),
    resolveSenderUsername(msg),
  ])

  const signal: TestSignal = {
    receivedAt: new Date().toISOString(),
    source: 'telegram',
    chatId,
    chatTitle,
    username,
    text: textRaw,
    messageLink: '',
  }
  appendTestSignal(signal)
}
