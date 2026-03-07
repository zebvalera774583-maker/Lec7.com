import { prisma } from '@/lib/prisma'
import { type ResolvedItem } from '@/lib/orchestrator/resolveCatalogItems'
import { normalizeIncomingOrder } from '@/lib/orchestrator/normalizeIncomingOrder'

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
  /** Строки, отфильтрованные как non-item (заголовки, компания, адрес) */
  comments?: string[]
  /** Индексы items, для которых нужна уточнение unit */
  needsUnitClarification?: number[]
  /** Индексы items, для которых нужна уточнение quantity */
  needsQtyClarification?: number[]
}

/**
 * Распознать потребности из текста (Orchestrator 2.1).
 * Тонкая обёртка над normalizeIncomingOrder.
 */
export async function recognizeNeedsForChat(
  chatId: string,
  message: string
): Promise<RecognizeResult> {
  const businessId = await getBusinessIdByChatId(chatId)
  if (!businessId) return { intent: 'unknown' }
  return normalizeIncomingOrder(
    { source: 'max_text', rawText: message },
    businessId
  )
}
