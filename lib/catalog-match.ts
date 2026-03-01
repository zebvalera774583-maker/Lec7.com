import { prisma } from '@/lib/prisma'

function normalizeForMatch(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Build norm -> masterItemId map (only unique matches). Call once per request batch. */
export async function buildCatalogNormMap(): Promise<Map<string, string>> {
  const catalogItems = await prisma.botCatalogItem.findMany({
    where: { scope: 'GLOBAL' },
    select: { id: true, canonicalName: true, synonyms: true },
  })
  const normToId = new Map<string, string>()
  const ambiguous = new Set<string>()
  for (const item of catalogItems) {
    const addMapping = (norm: string) => {
      if (!norm) return
      if (normToId.has(norm)) {
        if (normToId.get(norm) !== item.id) ambiguous.add(norm)
      } else {
        normToId.set(norm, item.id)
      }
    }
    addMapping(normalizeForMatch(item.canonicalName))
    for (const syn of item.synonyms) {
      addMapping(normalizeForMatch(syn))
    }
  }
  for (const k of ambiguous) {
    normToId.delete(k)
  }
  return normToId
}

/** Match item name to master catalog. Returns masterItemId or null if no unique match. */
export async function matchToMasterCatalog(itemName: string): Promise<string | null> {
  const norm = normalizeForMatch(itemName)
  if (!norm) return null
  const map = await buildCatalogNormMap()
  return map.get(norm) ?? null
}

/**
 * Best-match candidates: exact phrase, then n-grams of 2+ words (decreasing length),
 * then first word only. Single words like "салат" are NOT tried for multi-word phrases
 * (e.g. "айсберг салат" must not match "Лист салата" via synonym "салат").
 */
function getBestMatchCandidates(norm: string): string[] {
  const words = norm.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const seen = new Set<string>()
  const add = (s: string) => {
    if (s && !seen.has(s)) {
      seen.add(s)
      return true
    }
    return false
  }
  const candidates: string[] = []
  if (add(norm)) candidates.push(norm)
  for (let len = words.length - 1; len >= 2; len--) {
    for (let i = 0; i <= words.length - len; i++) {
      const ng = words.slice(i, i + len).join(' ')
      if (add(ng)) candidates.push(ng)
    }
  }
  if (words.length > 1 && add(words[0])) candidates.push(words[0])
  return candidates
}

/** Check if item name maps to catalog. Best-match: exact, then n-grams 2+ words, then first word only. */
export function matchToCatalogSync(normToId: Map<string, string>, itemName: string): boolean {
  const norm = normalizeForMatch(itemName)
  if (!norm) return false
  for (const c of getBestMatchCandidates(norm)) {
    if (normToId.has(c)) return true
  }
  return false
}

/** Build norm map for sync use in batch. Caller should call this once. */
export async function getCatalogNormMap(): Promise<Map<string, string>> {
  return buildCatalogNormMap()
}

