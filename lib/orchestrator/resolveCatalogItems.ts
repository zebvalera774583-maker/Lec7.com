import { prisma } from '@/lib/prisma'
import { matchToCatalogSyncWithNorm } from '@/lib/catalog-match'

function normalizeForMatch(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

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
}

/**
 * Сопоставить позиции с BotCatalogItem (только чтение, без создания).
 * Использует canonicalName + synonyms.
 */
export async function resolveCatalogItems(
  items: { name: string; quantity: string; unit: string }[],
  _businessId: string
): Promise<ResolvedItem[]> {
  const catalogItems = await prisma.botCatalogItem.findMany({
    where: { scope: 'GLOBAL', isActive: true },
    select: { id: true, canonicalName: true, synonyms: true },
  })

  const normToId = new Map<string, string>()
  const normToCanonical = new Map<string, string>()
  const ambiguous = new Set<string>()

  for (const item of catalogItems) {
    const addMapping = (norm: string) => {
      if (!norm) return
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

  const resolved: ResolvedItem[] = []
  for (const item of items) {
    const normalizedName = normalizeItemName(item.name)
    const matchedNorm = matchToCatalogSyncWithNorm(normToId, normalizedName)
    const catalogItemId = matchedNorm ? normToId.get(matchedNorm) ?? null : null
    const canonicalName = matchedNorm ? (normToCanonical.get(matchedNorm) ?? item.name) : item.name
    const confidence = catalogItemId ? 1 : 0
    const needsUserChoice = !catalogItemId || confidence < 0.8 // >1 кандидата или низкая уверенность

    resolved.push({
      catalogItemId,
      canonicalName,
      confidence,
      needsUserChoice,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
    })
  }

  return resolved
}
