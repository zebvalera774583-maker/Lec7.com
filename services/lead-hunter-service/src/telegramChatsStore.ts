/** Результаты discovery/join Telegram-чатов (in-memory, без БД). */
export interface TelegramChatDiscoveryRow {
  title: string
  username: string
  chatId: string
  query: string
  joinStatus: string
  /** ISO 8601, только если joinStatus === joined */
  joinedAt: string
}

const telegramChatDiscoveryRows: TelegramChatDiscoveryRow[] = []

export function getTelegramChats(): readonly TelegramChatDiscoveryRow[] {
  return telegramChatDiscoveryRows
}

export function appendTelegramChatDiscovery(row: TelegramChatDiscoveryRow): void {
  telegramChatDiscoveryRows.push(row)
}

/** Полная замена списка (после прохода discovery). */
export function replaceTelegramChats(rows: readonly TelegramChatDiscoveryRow[]): void {
  telegramChatDiscoveryRows.length = 0
  for (const r of rows) {
    telegramChatDiscoveryRows.push(r)
  }
}
