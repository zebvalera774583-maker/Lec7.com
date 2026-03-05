import { prisma } from '@/lib/prisma'
import { parseMaxRequestToRows } from '@/lib/parseMaxRequest'
import { resolveCatalogItems, type ResolvedItem } from '@/lib/orchestrator/resolveCatalogItems'

/**
 * Найти businessId по chatId (MaxChatContext / BusinessTelegramRecipient).
 * Fallback: BOT_BUSINESS_ID для бота без привязки чата.
 */
export async function getBusinessIdByChatId(chatId: string): Promise<string | null> {
  const maxCtx = await prisma.maxChatContext.findUnique({
    where: { chatId },
    select: { businessId: true },
  })
  if (maxCtx) return maxCtx.businessId

  const tgRecipient = await prisma.businessTelegramRecipient.findFirst({
    where: { chatId, isActive: true },
    select: { businessId: true },
  })
  if (tgRecipient) return tgRecipient.businessId

  return process.env.BOT_BUSINESS_ID?.trim() || null
}

export interface RecognizeResult {
  intent: 'create_needs' | 'unknown'
  items?: ResolvedItem[]
}

/**
 * Распознать потребности из текста (Orchestrator read-only).
 * Единственный источник items — parseMaxRequestToRows + resolveCatalogItems.
 */
export async function recognizeNeedsForChat(
  chatId: string,
  message: string
): Promise<RecognizeResult> {
  const businessId = await getBusinessIdByChatId(chatId)
  if (!businessId) {
    return { intent: 'unknown' }
  }

  const items = parseMaxRequestToRows(message, '')
  const isFallback =
    items.length === 1 &&
    items[0].name === message.trim() &&
    items[0].quantity === '1' &&
    items[0].unit === 'шт'

  if (items.length > 0 && !isFallback) {
    const resolved = await resolveCatalogItems(items, businessId)
    return { intent: 'create_needs', items: resolved }
  }

  return { intent: 'unknown' }
}
