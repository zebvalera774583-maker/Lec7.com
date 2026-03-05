import { prisma } from '@/lib/prisma'
import { parseSegment } from '@/lib/parseMaxRequest'
import { resolveCatalogItems, type ResolvedItem } from '@/lib/orchestrator/resolveCatalogItems'
import { buildAliasToCanonicalMap, preNormalizeLines } from '@/lib/orchestrator/preNormalizer'
import { segmentNeeds } from '@/lib/orchestrator/segmentNeeds'
import { applyUnitHeuristic } from '@/lib/orchestrator/unitHeuristic'
import { isLikelyNonItem } from '@/lib/orchestrator/nonItemFilter'

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
  const rawItems: { name: string; quantity: string; unit: string; originalSegment: string }[] = []
  for (const seg of normalizedSegments) {
    const parsed = parseSegment(seg)
    if (parsed) rawItems.push({ ...parsed, originalSegment: seg })
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

  // Non-item filter: заголовки/компания/адрес → comments
  const items: ResolvedItem[] = []
  const comments: string[] = []
  const needsUnitClarificationFiltered: number[] = []
  let itemIndex = 0

  for (let i = 0; i < resolved.length; i++) {
    const r = resolved[i]
    const segment = rawItems[i].originalSegment
    const matchScore = r.matchScore ?? 0
    const parsed = { name: r.name, quantity: r.quantity, unit: r.unit }
    const { isNonItem, reason } = isLikelyNonItem(segment, matchScore, parsed)

    if (isNonItem) {
      comments.push(segment)
      console.log(`[ORCH] non_item line="${segment.slice(0, 40)}" score=${matchScore.toFixed(2)} reason="${reason ?? ''}"`)
    } else {
      if (needsUnitClarification.includes(i)) {
        r.needsUnitClarification = true
        r.unit = ''
        needsUnitClarificationFiltered.push(itemIndex)
      } else {
        r.unit = itemsWithUnit[i].unit
      }
      items.push(r)
      itemIndex++
    }
  }

  const itemsShort = items.map((r) => ({ n: r.canonicalName.slice(0, 15), q: r.quantity, u: r.unit }))
  console.log(`[ORCH] used=true items=${JSON.stringify(itemsShort)} comments=${JSON.stringify(comments)}`)

  return {
    intent: 'create_needs',
    items,
    comments: comments.length > 0 ? comments : undefined,
    needsUnitClarification: needsUnitClarificationFiltered.length > 0 ? needsUnitClarificationFiltered : undefined,
  }
}
