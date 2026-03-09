/**
 * Единый pipeline для «Сформировать сводную таблицу» (request-summary) и «Сводная за период» (period-summary).
 * Одинаковая логика: нормализация, masterItemId, матчинг цен поставщиков.
 */

import { prisma } from '@/lib/prisma'
import { normalizeForMatch } from '@/lib/catalog-match'

const DEFAULT_CATEGORY = 'Свежая плодоовощная продукция'

/** Единица для сопоставления: игнорировать точку в конце (кг = кг.) */
export function normalizeUnitForComparison(unit: string): string {
  return (unit || '').trim().toLowerCase().replace(/\.$/, '') || ''
}

export type RequestItem = {
  name: string
  quantity: string
  unit: string
  /** Если задан — pipeline использует его вместо вычисления по name (для period-summary) */
  masterItemId?: string | null
}

export type ResultItem = {
  name: string
  originalName?: string
  masterItemId: string | null
  quantity: string
  unit: string
  offers: Record<string, number>
  analogues?: Record<string, { name: string; price: number }[]>
}

export type Counterparty = { id: string; legalName: string }

export type CatalogMaps = {
  catalogItems: { id: string; canonicalName: string; synonyms: string[] }[]
  normToId: Map<string, string>
  masterToCanonical: Map<string, string>
  masterItemIdToSearchNorms: Map<string, string[]>
}

export type OfferMaps = {
  masterToOffers: Map<string, Map<string, { price: number; legalName: string }>>
  normTitleToOffers: Map<string, Map<string, { price: number; legalName: string }>>
  supplierToRows: Map<string, { name: string; norm: string; price: number }[]>
}

/** Ключ агрегации для period-summary: masterItemId ?? norm (синонимы объединяются), unit без точки */
export function getAggregationKey(
  name: string,
  unit: string,
  normToId: Map<string, string>
): string {
  const norm = normalizeForMatch(name)
  const masterItemId = norm ? (normToId.get(norm) ?? null) : null
  return `${masterItemId ?? norm ?? name.toLowerCase().trim()}|${normalizeUnitForComparison(unit)}`
}

/** Построить карты каталога (normToId, masterToCanonical, masterItemIdToSearchNorms) */
export async function buildCatalogMaps(): Promise<CatalogMaps> {
  const catalogItems = await prisma.botCatalogItem.findMany({
    where: { scope: 'GLOBAL' },
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

  const masterToCanonical = new Map<string, string>()
  const masterItemIdToSearchNorms = new Map<string, string[]>()
  for (const item of catalogItems) {
    masterToCanonical.set(item.id, item.canonicalName)
    const norms: string[] = []
    const cn = normalizeForMatch(item.canonicalName)
    if (cn) norms.push(cn)
    for (const syn of item.synonyms) {
      const sn = normalizeForMatch(syn)
      if (sn && !norms.includes(sn)) norms.push(sn)
    }
    if (norms.length > 0) masterItemIdToSearchNorms.set(item.id, norms)
  }

  return { catalogItems, normToId, masterToCanonical, masterItemIdToSearchNorms }
}

export type ItemNeedingQuestion = { itemName: string; question: string }

/** Загрузить справочник таблицы №6: слово → вопрос */
export async function getClarificationMap(): Promise<Map<string, string>> {
  const rows = await prisma.clarificationQuestion.findMany({
    select: { word: true, question: true },
  })
  const map = new Map<string, string>()
  for (const r of rows) {
    const norm = normalizeForMatch(r.word)
    if (norm) map.set(norm, r.question)
  }
  return map
}

/**
 * Позиции, по которым нужен вопрос. Справочник (таблица №6): слово → вопрос.
 * «перец красный» → точное совпадение в каталоге → не вопрос.
 * «перец 6 кг» → название «перец», в справочнике → показываем вопрос.
 */
export function getItemsNeedingQuestion(
  items: { name: string }[],
  catalogMaps: CatalogMaps,
  clarificationMap: Map<string, string>
): ItemNeedingQuestion[] {
  const { normToId } = catalogMaps
  const result: ItemNeedingQuestion[] = []
  for (const it of items) {
    const name = (it.name || '').trim()
    if (!name) continue
    const norm = normalizeForMatch(name)
    if (!norm) continue
    if (normToId.has(norm)) continue
    const firstWord = norm.split(/\s+/)[0]
    const question = clarificationMap.get(firstWord)
    if (!question) continue
    result.push({ itemName: name, question })
  }
  return result
}

/** Fuzzy match: key from price list matches search norm */
function normMatchesPriceKey(searchNorm: string, priceNorm: string): boolean {
  if (!searchNorm || !priceNorm) return false
  if (searchNorm === priceNorm) return true
  if (priceNorm.startsWith(searchNorm) || searchNorm.startsWith(priceNorm)) return true
  if (searchNorm.length >= 2 && (priceNorm.includes(searchNorm) || searchNorm.includes(priceNorm))) return true
  return false
}

/** Загрузить прайсы и построить offer maps */
export async function buildOfferMaps(
  businessId: string,
  categoryParam: string = DEFAULT_CATEGORY
): Promise<{ offerMaps: OfferMaps; counterparties: Counterparty[]; hasOwnPrice: boolean }> {
  const categoryFilter = { OR: [{ category: categoryParam }, { category: null }] }

  const activeCounterparties = await prisma.activeCounterparty.findMany({
    where: {
      OR: [{ counterpartyBusinessId: businessId }, { businessId }],
    },
    select: { businessId: true, counterpartyBusinessId: true },
  })
  const activeSupplierIds = [...new Set(
    activeCounterparties.map((a) =>
      a.counterpartyBusinessId === businessId ? a.businessId : a.counterpartyBusinessId
    )
  )]

  const [ownPriceLists, counterpartyPriceLists] = await Promise.all([
    prisma.priceList.findMany({
      where: { businessId, kind: 'BASE', ...categoryFilter },
      include: {
        rows: { select: { masterItemId: true, name: true, priceWithVat: true, priceWithoutVat: true } },
      },
    }),
    activeSupplierIds.length > 0
      ? prisma.priceList.findMany({
          where: { businessId: { in: activeSupplierIds }, ...categoryFilter },
          include: {
            business: { select: { id: true, legalName: true, name: true } },
            rows: { select: { masterItemId: true, name: true, priceWithVat: true, priceWithoutVat: true } },
          },
        })
      : Promise.resolve([]),
  ])

  const masterToOffers = new Map<string, Map<string, { price: number; legalName: string }>>()
  const normTitleToOffers = new Map<string, Map<string, { price: number; legalName: string }>>()
  const supplierToRows = new Map<string, { name: string; norm: string; price: number }[]>()
  const counterpartySet = new Map<string, string>()

  const addOfferToMap = (
    map: Map<string, Map<string, { price: number; legalName: string }>>,
    key: string,
    supplierId: string,
    legalName: string,
    price: number
  ) => {
    let bySupplier = map.get(key)
    if (!bySupplier) {
      bySupplier = new Map()
      map.set(key, bySupplier)
    }
    const existing = bySupplier.get(supplierId)
    if (existing == null || price < existing.price) {
      bySupplier.set(supplierId, { price, legalName })
    }
    counterpartySet.set(supplierId, legalName)
  }

  const addRowToSupplier = (supplierId: string, name: string, price: number) => {
    const norm = normalizeForMatch(name)
    if (!norm) return
    let rows = supplierToRows.get(supplierId)
    if (!rows) {
      rows = []
      supplierToRows.set(supplierId, rows)
    }
    rows.push({ name, norm, price })
  }

  for (const pl of counterpartyPriceLists) {
    const supplierId = pl.business.id
    const legalName = (pl.business.legalName || '').trim() || pl.business.name
    counterpartySet.set(supplierId, legalName)
    for (const row of pl.rows) {
      const price = row.priceWithVat != null
        ? Number(row.priceWithVat)
        : row.priceWithoutVat != null
          ? Number(row.priceWithoutVat)
          : null
      if (price == null || Number.isNaN(price)) continue
      if (row.masterItemId) {
        addOfferToMap(masterToOffers, row.masterItemId, supplierId, legalName, price)
      } else {
        const norm = normalizeForMatch(row.name)
        if (norm) addOfferToMap(normTitleToOffers, norm, supplierId, legalName, price)
      }
      addRowToSupplier(supplierId, row.name, price)
    }
  }

  const hasOwnPrice = ownPriceLists.length > 0
  for (const pl of ownPriceLists) {
    const supplierId = '__OWN_PRICE__'
    const legalName = 'Мой прайс'
    for (const row of pl.rows) {
      const price = row.priceWithVat != null
        ? Number(row.priceWithVat)
        : row.priceWithoutVat != null
          ? Number(row.priceWithoutVat)
          : null
      if (price == null || Number.isNaN(price)) continue
      if (row.masterItemId) {
        addOfferToMap(masterToOffers, row.masterItemId, supplierId, legalName, price)
      } else {
        const norm = normalizeForMatch(row.name)
        if (norm) addOfferToMap(normTitleToOffers, norm, supplierId, legalName, price)
      }
      addRowToSupplier(supplierId, row.name, price)
    }
  }

  const partnerCounterparties = Array.from(counterpartySet.entries())
    .filter(([id]) => id !== '__OWN_PRICE__')
    .map(([id, legalName]) => ({ id, legalName }))
    .sort((a, b) => a.legalName.localeCompare(b.legalName, 'ru'))
  const counterparties: Counterparty[] = hasOwnPrice
    ? [{ id: '__OWN_PRICE__', legalName: 'Мой прайс' }, ...partnerCounterparties]
    : partnerCounterparties

  return {
    offerMaps: { masterToOffers, normTitleToOffers, supplierToRows },
    counterparties,
    hasOwnPrice,
  }
}

/**
 * Обработать requestItems → resultItems (единая логика матчинга цен).
 */
export function processRequestItemsToResult(
  requestItems: RequestItem[],
  catalogMaps: CatalogMaps,
  offerMaps: OfferMaps,
  counterparties: Counterparty[]
): ResultItem[] {
  const { normToId, masterToCanonical, masterItemIdToSearchNorms } = catalogMaps
  const { masterToOffers, normTitleToOffers, supplierToRows } = offerMaps

  const resultItems: ResultItem[] = []

  for (const it of requestItems) {
    const masterItemId = it.masterItemId != null ? it.masterItemId : (() => {
      const n = normalizeForMatch(it.name)
      return n ? (normToId.get(n) ?? null) : null
    })()
    const norm = normalizeForMatch(it.name)
    const searchNorms: string[] = norm ? [norm] : []
    if (masterItemId) {
      const extra = masterItemIdToSearchNorms.get(masterItemId) ?? []
      for (const s of extra) {
        if (s && !searchNorms.includes(s)) searchNorms.push(s)
      }
    }
    if (searchNorms.length === 0 && !masterItemId) continue

    const canonicalName = masterItemId ? (masterToCanonical.get(masterItemId) ?? it.name) : it.name

    const offers: Record<string, number> = {}

    // 1) By masterItemId (catalog-linked rows)
    if (masterItemId) {
      const bySupplier = masterToOffers.get(masterItemId)
      if (bySupplier) {
        for (const [sid, { price }] of bySupplier) offers[sid] = price
      }
    }

    // 2) By normTitleToOffers: exact + fuzzy (синонимы)
    for (const [priceNorm, bySupplier] of normTitleToOffers) {
      const matches = searchNorms.some((sn) => normMatchesPriceKey(sn, priceNorm))
      if (!matches) continue
      for (const [sid, { price }] of bySupplier) {
        const existing = offers[sid]
        if (existing == null || price < existing) offers[sid] = price
      }
    }

    // 3) Exact match from supplierToRows (прайс без masterItemId)
    for (const c of counterparties) {
      const sid = c.id
      if (offers[sid] != null) continue
      const rows = supplierToRows.get(sid) || []
      for (const row of rows) {
        if (searchNorms.includes(row.norm)) {
          offers[sid] = row.price
          break
        }
      }
    }

    // 4) Analogues: fuzzy match when no exact price
    const analogues: Record<string, { name: string; price: number }[]> = {}
    for (const c of counterparties) {
      const sid = c.id
      if (offers[sid] != null) continue
      const allMatches: { name: string; price: number }[] = []
      for (const sn of searchNorms) {
        if (sn.length < 2) continue
        const rows = supplierToRows.get(sid) || []
        for (const row of rows) {
          if (searchNorms.includes(row.norm)) continue
          if (row.norm.startsWith(sn) || row.norm.includes(' ' + sn) || (sn.length >= 3 && row.norm.includes(sn))) {
            if (!allMatches.some((m) => m.name === row.name && m.price === row.price)) {
              allMatches.push({ name: row.name, price: row.price })
            }
          }
        }
      }
      allMatches.sort((a, b) => a.price - b.price)
      if (allMatches.length > 0) analogues[sid] = allMatches.slice(0, 5)
    }

    resultItems.push({
      name: canonicalName,
      ...(canonicalName !== it.name && { originalName: it.name }),
      masterItemId: masterItemId ?? null,
      quantity: it.quantity,
      unit: it.unit,
      offers,
      ...(Object.keys(analogues).length > 0 && { analogues }),
    })
  }

  return resultItems
}
