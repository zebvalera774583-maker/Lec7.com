import { prisma } from '@/lib/prisma'
import { parseSegment } from '@/lib/parseMaxRequest'
import { resolveCatalogItems, type ResolvedItem } from '@/lib/orchestrator/resolveCatalogItems'
import { buildAliasToCanonicalMap, preNormalizeLines } from '@/lib/orchestrator/preNormalizer'
import { segmentNeeds } from '@/lib/orchestrator/segmentNeeds'
import { applyUnitHeuristic } from '@/lib/orchestrator/unitHeuristic'

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
  /** Индексы items, для которых нужна уточнение unit */
  needsUnitClarification?: number[]
}

/**
 * Распознать потребности из текста (Orchestrator read-only).
 * Pipeline: segmentNeeds (FIRST) → parseSegments → preNormalizer → resolveCatalogItems → unit heuristic.
 */
export async function recognizeNeedsForChat(
  chatId: string,
  message: string
): Promise<RecognizeResult> {
  const businessId = await getBusinessIdByChatId(chatId)
  if (!businessId) {
    return { intent: 'unknown' }
  }

  const segments = segmentNeeds(message)
  console.log(`[ORCH] segments=${JSON.stringify(segments)}`)

  const aliasMap = await buildAliasToCanonicalMap()
  const normalizedSegments = preNormalizeLines(segments, aliasMap)
  const rawItems: { name: string; quantity: string; unit: string }[] = []
  for (const seg of normalizedSegments) {
    const parsed = parseSegment(seg)
    if (parsed) rawItems.push(parsed)
  }

  const isFallback =
    rawItems.length === 1 &&
    rawItems[0].name === message.trim() &&
    rawItems[0].quantity === '1' &&
    !rawItems[0].unit

  if (rawItems.length === 0 || isFallback) {
    return { intent: 'unknown' }
  }

  // Unit heuristic для каждого item
  const itemsWithUnit: { name: string; quantity: string; unit: string }[] = []
  const needsUnitClarification: number[] = []

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i]
    const { unit, confidence } = applyUnitHeuristic(item.name, item.quantity, item.unit || undefined)

    const itemShort = JSON.stringify({ n: item.name.slice(0, 20), q: item.quantity, u: unit || '(empty)' })
    console.log(`[ORCH] unit_heuristic title="${item.name.slice(0, 30)}" qty="${item.quantity}" unit="${unit || ''}" confidence=${confidence}`)

    if (confidence === 'LOW' && !unit) {
      needsUnitClarification.push(i)
      itemsWithUnit.push({ name: item.name, quantity: item.quantity, unit: '' })
    } else {
      itemsWithUnit.push({
        name: item.name,
        quantity: item.quantity,
        unit: unit,
      })
    }
  }

  const resolved = await resolveCatalogItems(itemsWithUnit, businessId)

  for (let i = 0; i < resolved.length; i++) {
    if (needsUnitClarification.includes(i)) {
      resolved[i].needsUnitClarification = true
      resolved[i].unit = ''
    } else {
      resolved[i].unit = itemsWithUnit[i].unit
    }
  }

  const itemsShort = resolved.map((r) => ({ n: r.canonicalName.slice(0, 15), q: r.quantity, u: r.unit }))
  console.log(`[ORCH] used=true items=${JSON.stringify(itemsShort)}`)

  return {
    intent: 'create_needs',
    items: resolved,
    needsUnitClarification: needsUnitClarification.length > 0 ? needsUnitClarification : undefined,
  }
}
