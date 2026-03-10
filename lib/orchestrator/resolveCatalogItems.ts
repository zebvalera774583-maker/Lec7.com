import { prisma } from '@/lib/prisma'
import { matchToCatalogSyncWithNorm, normalizeForMatch } from '@/lib/catalog-match'
import { ORCHESTRATOR_CONFIG } from '@/lib/orchestrator/config'
import { buildTokenIndex, tokenMatchCatalog } from '@/lib/orchestrator/tokenMatchCatalog'

/**
 * Нормализация названия позиции перед сопоставлением с каталогом:
 * trim, убрать ведущую/хвостовую пунктуацию, схлопнуть пробелы.
 * Дефисы/слэши внутри слова (соус-барбекю, сахар/песок) не трогаем.
 */
export function normalizeItemName(name: string): string {
  let s = (name || '').trim()
  s = s.replace(/^[\s,.;:!?()[\]{}"']+/, '').replace(/[\s,.;:!?()[\]{}"']+$/, '')
  return s.replace(/\s+/g, ' ').trim()
}

export interface ResolvedItem {
  catalogItemId: string | null
  canonicalName: string
  confidence: number
  needsUserChoice: boolean
  /** Исходные данные из парсера */
  name: string
  quantity: string
  unit: string
  /** Требуется уточнение unit от пользователя (эвристика дала LOW) */
  needsUnitClarification?: boolean
  /** Тип совпадения с каталогом */
  matchType?: 'alias' | 'learned' | 'token' | 'none'
  /** Score совпадения (alias=1, learned=1, token=0.6..1, none=0) */
  matchScore?: number
  /** Карточка Master Catalog с requiresClarification — не матчить, запустить уточнение */
  requiresClarification?: boolean
  /** Варианты для кнопок уточнения (при requiresClarification=true) */
  clarificationOptions?: string[]
}

/**
 * Сопоставить позиции с BotCatalogItem (только чтение, без создания).
 * 1) Alias match (catalog)
 * 2) Alias match (learned)
 * 3) Token fuzzy match
 */
export async function resolveCatalogItems(
  items: { name: string; quantity: string; unit: string }[],
  businessId: string
): Promise<ResolvedItem[]> {
  const [catalogItems, learnedAliases] = await Promise.all([
    prisma.botCatalogItem.findMany({
      where: { scope: 'GLOBAL', isActive: true },
      select: { id: true, canonicalName: true, synonyms: true, requiresClarification: true, clarificationOptions: true },
    }),
    prisma.botLearnedAlias.findMany({
      where: { businessId },
      select: { aliasText: true, canonicalName: true },
    }),
  ])

  const normToId = new Map<string, string>()
  const normToCanonical = new Map<string, string>()
  const canonicalToId = new Map<string, string>()
  const ambiguous = new Set<string>()
  const clarificationNormToOptions = new Map<string, string[]>()

  for (const item of catalogItems) {
    canonicalToId.set(item.canonicalName, item.id)
    const options = item.requiresClarification && item.clarificationOptions?.length >= 2
      ? item.clarificationOptions
      : null
    const addMapping = (norm: string) => {
      if (!norm) return
      if (options) {
        clarificationNormToOptions.set(norm, options)
        return
      }
      if (normToId.has(norm)) {
        if (normToId.get(norm) !== item.id) ambiguous.add(norm)
      } else {
        normToId.set(norm, item.id)
        normToCanonical.set(norm, item.canonicalName)
      }
    }
    addMapping(normalizeForMatch(item.canonicalName))
    for (const syn of item.synonyms) {
      addMapping(normalizeForMatch(syn))
    }
  }
  for (const k of ambiguous) {
    normToId.delete(k)
    normToCanonical.delete(k)
  }

  const learnedNormToCanonical = new Map<string, string>()
  for (const la of learnedAliases) {
    const norm = normalizeForMatch(la.aliasText)
    if (norm && canonicalToId.has(la.canonicalName)) {
      learnedNormToCanonical.set(norm, la.canonicalName)
    }
  }

  const tokenIndex = buildTokenIndex(
    catalogItems.map((c) => ({ canonicalName: c.canonicalName, synonyms: c.synonyms }))
  )

  const resolved: ResolvedItem[] = []
  for (const item of items) {
    const normalizedName = normalizeItemName(item.name)
    const norm = normalizeForMatch(item.name)
    const words = norm.split(/\s+/).filter(Boolean)
    const firstWord = words[0] ?? ''
    const clarificationOpts = firstWord ? clarificationNormToOptions.get(firstWord) : null
    if (clarificationOpts && clarificationOpts.length >= 2) {
      resolved.push({
        catalogItemId: null,
        canonicalName: item.name,
        confidence: 0,
        needsUserChoice: true,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        matchType: 'none',
        matchScore: 0,
        requiresClarification: true,
        clarificationOptions: clarificationOpts,
      })
      continue
    }

    let catalogItemId: string | null = null
    let canonicalName = item.name
    let matchType: 'alias' | 'learned' | 'token' | 'none' = 'none'
    let matchScore = 0

    const matchedNorm = matchToCatalogSyncWithNorm(normToId, normalizedName)
    if (matchedNorm) {
      catalogItemId = normToId.get(matchedNorm) ?? null
      canonicalName = normToCanonical.get(matchedNorm) ?? item.name
      matchType = 'alias'
      matchScore = 1
    } else {
      const learnedCanonical = learnedNormToCanonical.get(normalizedName)
      if (learnedCanonical) {
        canonicalName = learnedCanonical
        catalogItemId = canonicalToId.get(learnedCanonical) ?? null
        matchType = 'learned'
        matchScore = 1
      } else {
        const tokenResult = tokenMatchCatalog(normalizedName, tokenIndex)
        if (tokenResult) {
          canonicalName = tokenResult.canonicalName
          catalogItemId = canonicalToId.get(canonicalName) ?? null
          matchType = 'token'
          matchScore = tokenResult.matchScore
          console.log(
            `[ORCH] token_match title="${item.name.slice(0, 30)}" canonical="${canonicalName.slice(0, 20)}" score=${matchScore.toFixed(2)}`
          )
        }
      }
    }

    const matchedCatalogItem = catalogItemId ? catalogItems.find((c) => c.id === catalogItemId) : null
    if (matchedCatalogItem?.requiresClarification && matchedCatalogItem.clarificationOptions?.length >= 2) {
      resolved.push({
        catalogItemId: null,
        canonicalName: item.name,
        confidence: 0,
        needsUserChoice: true,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        matchType: 'none',
        matchScore: 0,
        requiresClarification: true,
        clarificationOptions: matchedCatalogItem.clarificationOptions,
      })
      continue
    }

    const confidence =
      matchType === 'token' ? matchScore : catalogItemId ? 1 : 0
    const needsUserChoice = confidence < ORCHESTRATOR_CONFIG.highConfidenceThreshold

    resolved.push({
      catalogItemId,
      canonicalName,
      confidence,
      needsUserChoice,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      matchType,
      matchScore,
    })
  }

  return resolved
}
