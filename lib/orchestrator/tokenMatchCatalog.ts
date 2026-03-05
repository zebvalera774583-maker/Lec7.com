/**
 * Token-based fuzzy match для каталога.
 * Когда alias match не найден — ищем по токенам.
 */

import { ORCHESTRATOR_CONFIG } from './config'

const STOP_WORDS = new Set([
  'кг', 'г', 'гр', 'л', 'мл', 'шт', 'уп', 'упак', 'пач', 'ящ', 'т', 'пуч', 'кор',
])

const ENDINGS = ['ый', 'ая', 'ое', 'ие', 'ые']

/**
 * Нормализация текста в токены для fuzzy match.
 * lowercase, ё→е, убрать пунктуацию, стоп-слова, мягкая обрезка окончаний.
 */
export function normalizeTokens(text: string): Set<string> {
  let s = (text || '').trim().toLowerCase()
  s = s.replace(/ё/g, 'е')
  s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  if (!s) return new Set()
  const words = s.split(/\s+/).filter(Boolean)
  const result = new Set<string>()
  for (let w of words) {
    if (STOP_WORDS.has(w)) continue
    if (w.length > 5) {
      for (const end of ENDINGS) {
        if (w.endsWith(end) && w.length > end.length + 2) {
          w = w.slice(0, -end.length)
          break
        }
      }
    }
    if (w.length >= 2) result.add(w)
  }
  return result
}

export interface TokenIndex {
  tokenToCanonical: Map<string, Set<string>>
  canonicalToTokens: Map<string, Set<string>>
}

/**
 * Построить индекс токенов из каталога.
 * canonicalName + synonyms → токены.
 */
export function buildTokenIndex(
  catalogItems: { canonicalName: string; synonyms: string[] }[]
): TokenIndex {
  const tokenToCanonical = new Map<string, Set<string>>()
  const canonicalToTokens = new Map<string, Set<string>>()

  const addTokens = (canonical: string, text: string) => {
    const tokens = normalizeTokens(text)
    if (tokens.size === 0) return
    if (!canonicalToTokens.has(canonical)) {
      canonicalToTokens.set(canonical, new Set())
    }
    const existing = canonicalToTokens.get(canonical)!
    for (const t of tokens) {
      existing.add(t)
      if (!tokenToCanonical.has(t)) tokenToCanonical.set(t, new Set())
      tokenToCanonical.get(t)!.add(canonical)
    }
  }

  for (const item of catalogItems) {
    addTokens(item.canonicalName, item.canonicalName)
    for (const syn of item.synonyms) addTokens(item.canonicalName, syn)
  }

  return { tokenToCanonical, canonicalToTokens }
}

export interface TokenMatchResult {
  canonicalName: string
  matchType: 'alias' | 'token' | 'none'
  matchScore: number
}

/**
 * Поиск в каталоге по токенам.
 * score = intersection / tokensQ.length
 * Tie-breaker: при равенстве score — более длинный canonicalName.
 */
export function tokenMatchCatalog(
  queryTitle: string,
  tokenIndex: TokenIndex,
  threshold = ORCHESTRATOR_CONFIG.tokenMatchThreshold
): TokenMatchResult | null {
  const tokensQ = normalizeTokens(queryTitle)
  if (tokensQ.size === 0) return null

  const candidates = new Set<string>()
  for (const t of tokensQ) {
    const set = tokenIndex.tokenToCanonical.get(t)
    if (set) for (const c of set) candidates.add(c)
  }
  if (candidates.size === 0) return null

  let best: { canonical: string; score: number } | null = null
  for (const canon of candidates) {
    const tokensC = tokenIndex.canonicalToTokens.get(canon)
    if (!tokensC) continue
    const inter = [...tokensQ].filter((x) => tokensC.has(x)).length
    const score = inter / tokensQ.size
    if (score >= threshold) {
      if (!best || score > best.score || (score === best.score && canon.length > best.canonical.length)) {
        best = { canonical: canon, score }
      }
    }
  }
  if (!best) return null
  return {
    canonicalName: best.canonical,
    matchType: 'token',
    matchScore: best.score,
  }
}
