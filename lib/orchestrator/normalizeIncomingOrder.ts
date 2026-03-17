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
  /** Индексы items, требующих уточнения (Master Catalog: requiresClarification) */
  needsClarification?: number[]
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

  const inputLines = (input.lines ?? text.split(/\n/).map((l) => l.trim()).filter(Boolean)) as string[]
  console.log('[PARSE INPUT]', inputLines)

  const textForAI =
    input.source === 'max_photo' || input.source === 'telegram_photo'
      ? inputLines.filter((line) => /\d/.test(line)).join('\n')
      : text
  if ((input.source === 'max_photo' || input.source === 'telegram_photo') && !textForAI.trim()) {
    console.log('[PARSE SKIPPED] OCR: no lines with quantity')
    return { intent: 'unknown' }
  }

  let rawItems: RawItem[]

  try {
    console.log('[ORCH][AI] request source=', input.source, 'text=', (textForAI || text).slice(0, 80))
    const aiItems = await recognizeOrderWithAI(textForAI || text)
    console.log('[PARSE RESULT]', aiItems.map((a) => `${a.name} ${a.quantity} ${a.unit}`.trim()))

    if (aiItems.length > 0) {
      const skipEmptyQty = input.source === 'max_photo' || input.source === 'telegram_photo'
      rawItems = aiItems
        .filter((a) => !skipEmptyQty || (a.quantity != null && String(a.quantity).trim() !== ''))
        .map((a) => {
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
      console.log('[PARSE SKIPPED] AI returned 0 items for input lines=', inputLines.slice(0, 5))
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
  const needsClarificationFiltered: number[] = []
  let itemIndex = 0

  const HIGH = ORCHESTRATOR_CONFIG.highConfidenceThreshold

  for (let i = 0; i < resolved.length; i++) {
    const r = resolved[i]
    const raw = rawItems[i]
    const segment = raw.originalSegment
    const matchScore = r.matchScore ?? 0

    if (r.requiresClarification) {
      r.canonicalName = sanitizeTitle(r.canonicalName)
      r.name = sanitizeTitle(r.name)
      r.unit = itemsWithUnit[i].unit
      items.push(r)
      needsClarificationFiltered.push(itemIndex)
      itemIndex++
      continue
    }

    if (isGarbageSegment(segment, raw)) {
      comments.push(segment)
      console.log(`[PARSE SKIPPED] reason=garbage segment="${segment.slice(0, 50)}"`)
      continue
    }

    const nonItem = isLikelyNonItem(segment, matchScore, raw)
    if (nonItem.isNonItem) {
      comments.push(segment)
      console.log(`[PARSE SKIPPED] reason=nonItem (${nonItem.reason}) segment="${segment.slice(0, 50)}"`)
      continue
    }

    if (r.matchType === 'token' && matchScore < HIGH) {
      comments.push(segment)
      console.log(`[PARSE SKIPPED] reason=weak_token score=${matchScore.toFixed(2)} segment="${segment.slice(0, 50)}"`)
      continue
    }

    if (isDoubtfulSegment(segment, raw, r, { hasDashTerminated: raw.hasDashTerminated })) {
      comments.push(segment)
      console.log(`[PARSE SKIPPED] reason=doubtful segment="${segment.slice(0, 50)}" canonical="${r.canonicalName.slice(0, 20)}"`)
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
      console.log(`[PARSE SKIPPED] reason=verdict_COMMENT segment="${segment.slice(0, 50)}"`)
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

      if ((verdict === 'ITEM' || verdict === 'ITEM_AUTO') && !r.requiresClarification) {
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
    needsClarification:
      needsClarificationFiltered.length > 0 ? needsClarificationFiltered : undefined,
  }
}
