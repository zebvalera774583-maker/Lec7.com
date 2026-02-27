export interface BotEvent {
  channel: 'telegram' | 'max'
  chatId: string
  userId?: string
  username?: string
  text: string
  raw?: unknown
}

export async function handleBotEvent(event: BotEvent): Promise<{ messages: string[] }> {
  const text = event.text.trim()
  const messages: string[] = []

  if (text.startsWith('/start')) {
    messages.push('Привет! Напиши потребность одним сообщением, я передам в Lec7 ✅')
  } else {
    messages.push(`Принял: "${text}" ✅`)
  }

  return { messages }
}
