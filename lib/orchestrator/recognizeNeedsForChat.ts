import { prisma } from '@/lib/prisma'
import { parseSegment } from '@/lib/parseMaxRequest'
import { resolveCatalogItems, type ResolvedItem } from '@/lib/orchestrator/resolveCatalogItems'
import { buildAliasToCanonicalMap, preNormalizeLines } from '@/lib/orchestrator/preNormalizer'
import { segmentNeeds } from '@/lib/orchestrator/segmentNeeds'
import { applyUnitHeuristic } from '@/lib/orchestrator/unitHeuristic'
import { extractFeatures } from '@/lib/orchestrator/extractFeatures'
import { decide } from '@/lib/orchestrator/decisionEngine'
import { maybeLearnAlias } from '@/lib/orchestrator/learningLoop'
import { sanitizeTitle } from '@/lib/orchestrator/sanitizeTitle'
import { ORCHESTRATOR_CONFIG } from '@/lib/orchestrator/config'
import { isDoubtfulSegment, isGarbageSegment, isLikelyNonItem } from '@/lib/orchestrator/nonItemFilter'

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
 * Pipeline: segmentNeeds → parseSegment → preNormalizer → resolveCatalogItems → extractFeatures → decisionEngine → learningLoop.
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
  const rawItems: { rawText: string; name: string; quantity: string; unit: string; hasDashTerminated: boolean; originalSegment: string }[] = []
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

  let resolved: ResolvedItem[]
  try {
    resolved = await resolveCatalogItems(itemsWithUnit, businessId)
  } catch (err) {
    console.error('[ORCH] resolveCatalogItems error', err)
    return { intent: 'unknown' }
  }

  const items: ResolvedItem[] = []
  const comments: string[] = []
  const needsUnitClarificationFiltered: number[] = []
  const needsQtyClarificationFiltered: number[] = []
  let itemIndex = 0

  const HIGH = ORCHESTRATOR_CONFIG.highConfidenceThreshold

  for (let i = 0; i < resolved.length; i++) {
    const r = resolved[i]
    const raw = rawItems[i]
    const segment = raw.originalSegment
    const matchScore = r.matchScore ?? 0

    if (isGarbageSegment(segment, raw)) {
      comments.push(segment)
      console.log(`[ORCH] safeguard garbage segment="${segment.slice(0, 30)}" → comment`)
      continue
    }

    const nonItem = isLikelyNonItem(segment, matchScore, raw)
    if (nonItem.isNonItem) {
      comments.push(segment)
      console.log(`[ORCH] safeguard nonItem reason=${nonItem.reason} segment="${segment.slice(0, 30)}" → comment`)
      continue
    }

    if (r.matchType === 'token' && matchScore < HIGH) {
      comments.push(segment)
      console.log(`[ORCH] safeguard weak token match score=${matchScore.toFixed(2)} < ${HIGH} → comment`)
      continue
    }

    if (isDoubtfulSegment(segment, raw, r, { hasDashTerminated: raw.hasDashTerminated })) {
      comments.push(segment)
      console.log(`[ORCH] safeguard doubtful segment="${segment.slice(0, 30)}" canonical="${r.canonicalName.slice(0, 20)}" → comment`)
      continue
    }

    const features = extractFeatures(
      { ...raw, rawText: segment },
      { matchType: r.matchType, matchScore: r.matchScore }
    )
    const { verdict, reason } = decide(features)

    console.log(`[ORCH] decide verdict=${verdict} reason=${reason}`)

    if (verdict === 'COMMENT') {
      comments.push(segment)
    } else {
      r.canonicalName = sanitizeTitle(r.canonicalName)
      r.name = sanitizeTitle(r.name)
      r.unit = itemsWithUnit[i].unit
      if (verdict === 'ASK_QTY') {
        r.quantity = ''
        r.needsUnitClarification = false
        needsQtyClarificationFiltered.push(itemIndex)
      } else if (verdict === 'ASK_UNIT' || verdict === 'ITEM_ASK_UNIT' || needsUnitClarification.includes(i)) {
        r.needsUnitClarification = true
        r.unit = ''
        needsUnitClarificationFiltered.push(itemIndex)
      }
      items.push(r)
      itemIndex++

      if (verdict === 'ITEM' || verdict === 'ITEM_AUTO') {
        maybeLearnAlias(
          businessId,
          raw.name,
          r.canonicalName,
          r.matchType ?? 'none',
          r.matchScore ?? 0,
          verdict
        ).catch(() => {})
      }
    }
  }

  const itemsShort = items.map((r) => ({ n: r.canonicalName.slice(0, 15), q: r.quantity, u: r.unit }))
  console.log(`[ORCH] used=true items=${JSON.stringify(itemsShort)} comments=${JSON.stringify(comments)}`)

  return {
    intent: 'create_needs',
    items,
    comments: comments.length > 0 ? comments : undefined,
    needsUnitClarification: needsUnitClarificationFiltered.length > 0 ? needsUnitClarificationFiltered : undefined,
    needsQtyClarification: needsQtyClarificationFiltered.length > 0 ? needsQtyClarificationFiltered : undefined,
  }
}
