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

/** Check if item name maps to catalog. For batch use. */
export function matchToCatalogSync(normToId: Map<string, string>, itemName: string): boolean {
  const norm = normalizeForMatch(itemName)
  if (!norm) return false
  return normToId.has(norm)
}

/** Build norm map for sync use in batch. Caller should call this once. */
export async function getCatalogNormMap(): Promise<Map<string, string>> {
  return buildCatalogNormMap()
}

