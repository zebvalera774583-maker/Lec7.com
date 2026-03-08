import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess } from '@/lib/access'

const DEFAULT_CATEGORY = 'Свежая плодоовощная продукция'

function normalizeForMatch(s: string): string {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/[.,;:()\[\]{}"'`]/g, '')
    .replace(/\s+/g, ' ')
}

export const POST = withBusinessAccess(async (req, user) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const body = await req.json()
    const items = Array.isArray(body.items) ? body.items : []
    const categoryParam = (body.category || DEFAULT_CATEGORY) as string
    const categoryFilter = { OR: [{ category: categoryParam }, { category: null }] }

    const requestItems = items
      .map((it: any) => ({
        name: typeof it.name === 'string' ? it.name.trim() : '',
        quantity: typeof it.quantity === 'string' ? it.quantity : String(it.quantity ?? ''),
        unit: typeof it.unit === 'string' ? it.unit.trim() : '',
      }))
      .filter((it: { name: string }) => it.name.length > 0)

    if (requestItems.length === 0) {
      return NextResponse.json({ error: 'Укажите хотя бы одну позицию с наименованием' }, { status: 400 })
    }

    // 1) Build catalog map: norm -> masterItemId (only unique)
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

    // 2) Load ALL price rows — действующий контрагент = видит все прайсы поставщика (не только назначенные)
    const activeAssignments = await prisma.priceAssignment.findMany({
      where: { counterpartyBusinessId: businessId, status: 'ACTIVE' },
      select: { priceList: { select: { businessId: true } } },
    })
    const activeSupplierIds = [...new Set(activeAssignments.map((a) => a.priceList.businessId))]

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

    // 3) Build masterItemId -> offers, normTitle -> offers, and supplierId -> rows (for analogues)
    const masterToOffers = new Map<string, Map<string, { price: number; legalName: string }>>()
    const normTitleToOffers = new Map<string, Map<string, { price: number; legalName: string }>>()
    const supplierToRows = new Map<string, { name: string; norm: string; price: number }[]>()
    const counterpartySet = new Map<string, string>()

    for (const pl of counterpartyPriceLists) {
      const supplierId = pl.business.id
      const legalName = (pl.business.legalName || '').trim() || pl.business.name
      counterpartySet.set(supplierId, legalName)
    }

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
    const counterparties = hasOwnPrice
      ? [{ id: '__OWN_PRICE__', legalName: 'Мой прайс' }, ...partnerCounterparties]
      : partnerCounterparties

    // 4) Build masterItemId -> canonicalName
    const masterToCanonical = new Map<string, string>()
    for (const item of catalogItems) {
      masterToCanonical.set(item.id, item.canonicalName)
    }

    // 5) Map request items to result
    const resultItems: {
      name: string
      originalName?: string
      masterItemId: string | null
      quantity: string
      unit: string
      offers: Record<string, number>
      analogues?: Record<string, { name: string; price: number }[]>
    }[] = []

    for (const it of requestItems) {
      const norm = normalizeForMatch(it.name)
      const masterItemId = norm ? (normToId.get(norm) ?? null) : null
      const canonicalName = masterItemId ? (masterToCanonical.get(masterItemId) ?? it.name) : null

      const offers: Record<string, number> = {}
      // 1) First by masterItemId (catalog)
      if (masterItemId) {
        const bySupplier = masterToOffers.get(masterItemId)
        if (bySupplier) {
          for (const [sid, { price }] of bySupplier) {
            offers[sid] = price
          }
        }
      }
      // 2) If no prices — by name from price lists (same as table 3)
      if (Object.keys(offers).length === 0 && norm) {
        const bySupplier = normTitleToOffers.get(norm)
        if (bySupplier) {
          for (const [sid, { price }] of bySupplier) {
            offers[sid] = price
          }
        }
      }

      // 3) Analogues: для поставщиков без точной цены — похожие позиции (напр. картофель → картофель белый)
      const analogues: Record<string, { name: string; price: number }[]> = {}
      const searchNorm = norm || normalizeForMatch(it.name)
      if (searchNorm && searchNorm.length >= 2) {
        for (const { id: sid } of counterparties) {
          if (offers[sid] != null) continue
          const rows = supplierToRows.get(sid) || []
          const matches: { name: string; price: number }[] = []
          for (const row of rows) {
            if (row.norm === searchNorm) continue
            if (row.norm.startsWith(searchNorm) || row.norm.includes(' ' + searchNorm) || (searchNorm.length >= 3 && row.norm.includes(searchNorm))) {
              matches.push({ name: row.name, price: row.price })
            }
          }
          matches.sort((a, b) => a.price - b.price)
          if (matches.length > 0) {
            analogues[sid] = matches.slice(0, 5)
          }
        }
      }

      resultItems.push({
        name: canonicalName ?? it.name,
        ...(canonicalName && canonicalName !== it.name && { originalName: it.name }),
        masterItemId,
        quantity: it.quantity,
        unit: it.unit,
        offers,
        analogues: Object.keys(analogues).length > 0 ? analogues : undefined,
      })
    }

    return NextResponse.json({
      items: resultItems,
      counterparties,
    })
  } catch (error) {
    console.error('Request summary error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
