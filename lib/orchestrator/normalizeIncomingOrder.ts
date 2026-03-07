/**
 * Единый модуль нормализации входящих заявок.
 * Любой вход (текст, OCR, PDF, Excel) → единый результат.
 *
 * Используется: recognizeNeedsForChat, handleBotEvent, API routes.
 * Подготовлен для: OCR lines/layout, PDF/Excel без переписывания логики.
 */

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
import { recognizeOrderWithAI } from '@/lib/ai/recognizeOrderWithAI'

export type NormalizeInputSource =
  | 'max_text'
  | 'max_photo'
  | 'telegram_text'
  | 'telegram_photo'
  | 'pdf'
  | 'excel'

export interface NormalizeInput {
  source: NormalizeInputSource
  rawText?: string
  lines?: string[]
  layout?: unknown
}

export interface NormalizeResult {
  intent: 'create_needs' | 'unknown'
  items?: ResolvedItem[]
  comments?: string[]
  needsUnitClarification?: number[]
  needsQtyClarification?: number[]
}

type RawItem = {
  rawText: string
  name: string
  quantity: string
  unit: string
  hasDashTerminated: boolean
  originalSegment: string
}

/**
 * Нормализовать входящую заявку в единый формат.
 * AI-first, fallback при технической ошибке.
 */
export async function normalizeIncomingOrder(
  input: NormalizeInput,
  businessId: string
): Promise<NormalizeResult> {
  const text =
    input.lines && input.lines.length > 0 ? input.lines.join('\n') : (input.rawText || '').trim()
  if (!text) return { intent: 'unknown' }

  let rawItems: RawItem[]

  try {
    console.log('[ORCH][AI] request source=', input.source, 'text=', text.slice(0, 80))
    const aiItems = await recognizeOrderWithAI(text)

    if (aiItems.length > 0) {
      rawItems = aiItems.map((a) => {
        const seg = `${a.name} ${a.quantity} ${a.unit}`.trim()
        return {
          rawText: seg,
          name: a.name.trim(),
          quantity: a.quantity || '1',
          unit: a.unit || '',
          hasDashTerminated: false,
          originalSegment: seg,
        }
      })
      console.log('[ORCH][AI] success items=', rawItems.length, rawItems.map((r) => r.name.slice(0, 15)))
    } else {
      console.log('[ORCH][AI] success items=0 (empty)')
      return { intent: 'unknown' }
    }
  } catch (err) {
    console.log('[ORCH][AI] error fallback=true', err instanceof Error ? err.message : String(err))
    const segments = segmentNeeds(text)
    console.log(`[ORCH] segments=${JSON.stringify(segments)}`)

    const aliasMap = await buildAliasToCanonicalMap()
    const normalizedSegments = preNormalizeLines(segments, aliasMap)
    rawItems = []
    for (const seg of normalizedSegments) {
      const parsed = parseSegment(seg)
      if (parsed) rawItems.push({ ...parsed, originalSegment: seg })
    }
  }

  const isFallback =
    rawItems.length === 1 &&
    rawItems[0].name === text.trim() &&
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

    console.log(
      `[ORCH] unit_heuristic title="${item.name.slice(0, 30)}" qty="${item.quantity}" unit="${unit || ''}" confidence=${confidence}`
    )

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
      console.log(
        `[ORCH] safeguard nonItem reason=${nonItem.reason} segment="${segment.slice(0, 30)}" → comment`
      )
      continue
    }

    if (r.matchType === 'token' && matchScore < HIGH) {
      comments.push(segment)
      console.log(
        `[ORCH] safeguard weak token match score=${matchScore.toFixed(2)} < ${HIGH} → comment`
      )
      continue
    }

    if (isDoubtfulSegment(segment, raw, r, { hasDashTerminated: raw.hasDashTerminated })) {
      comments.push(segment)
      console.log(
        `[ORCH] safeguard doubtful segment="${segment.slice(0, 30)}" canonical="${r.canonicalName.slice(0, 20)}" → comment`
      )
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
      } else if (
        verdict === 'ASK_UNIT' ||
        verdict === 'ITEM_ASK_UNIT' ||
        needsUnitClarification.includes(i)
      ) {
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
  console.log(
    `[ORCH] used=true items=${JSON.stringify(itemsShort)} comments=${JSON.stringify(comments)}`
  )

  return {
    intent: 'create_needs',
    items,
    comments: comments.length > 0 ? comments : undefined,
    needsUnitClarification:
      needsUnitClarificationFiltered.length > 0 ? needsUnitClarificationFiltered : undefined,
    needsQtyClarification:
      needsQtyClarificationFiltered.length > 0 ? needsQtyClarificationFiltered : undefined,
  }
}
