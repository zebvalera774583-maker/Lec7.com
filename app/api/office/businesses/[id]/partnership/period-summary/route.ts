import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess, getBusinessIdFromPath } from '@/lib/access'

const DEFAULT_CATEGORY = 'Свежая плодоовощная продукция'

function normalizeForMatch(s: string): string {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/[.,;:()\[\]{}"'`]/g, '')
    .replace(/\s+/g, ' ')
}

/** Парсинг позиций из description/title заявки MAX (как parseMaxRequestToRows) */
function parseMaxRequestToRows(title: string, description: string): { name: string; quantity: string; unit: string }[] {
  const text = (description || title || '').trim()
  if (!text) return []
  const cleanTitle = (title || '').replace(/^Заявка из MAX:\s*/i, '').trim()
  const src = description || cleanTitle || text
  const rows: { name: string; quantity: string; unit: string }[] = []
  const re = /([^\d]+?)[\s\-]+(\d+(?:[.,]\d+)?)\s*(кг|шт|т|л|м|ед)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const name = m[1].trim()
    const quantity = m[2].replace(',', '.')
    const unit = ((m[3] || 'шт') as string).toLowerCase()
    if (name) rows.push({ name, quantity, unit })
  }
  if (rows.length === 0) rows.push({ name: src, quantity: '1', unit: 'шт' })
  return rows
}

export const GET = withBusinessAccess(async (req) => {
  try {
    const pathname = new URL(req.url).pathname
    const businessId = getBusinessIdFromPath(pathname)
    const url = new URL(req.url)
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const fromDate = dateFrom ? new Date(dateFrom) : null
    const toDate = dateTo ? new Date(dateTo) : null
    if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return NextResponse.json({ error: 'Укажите dateFrom и dateTo (YYYY-MM-DD)' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const requests = await prisma.request.findMany({
      where: {
        businessId,
        source: 'max_integration',
        status: { not: 'ARCHIVED' },
        createdAt: {
          gte: fromDate,
          lte: new Date(toDate.getTime() + 86400000),
        },
      },
      select: { title: true, description: true },
    })

    const agg = new Map<string, { name: string; quantity: number; unit: string }>()
    for (const r of requests) {
      const rows = parseMaxRequestToRows(r.title || '', r.description || '')
      for (const row of rows) {
        const key = `${row.name.toLowerCase().trim()}|${row.unit}`
        const qty = parseFloat(row.quantity) || 0
        const existing = agg.get(key)
        if (existing) {
          existing.quantity += qty
        } else {
          agg.set(key, { name: row.name.trim(), quantity: qty, unit: row.unit })
        }
      }
    }

    const requestItems = Array.from(agg.values())
      .filter((it) => it.name.length > 0 && it.quantity > 0)
      .map((it) => ({
        name: it.name,
        quantity: String(it.quantity),
        unit: it.unit,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

    if (requestItems.length === 0) {
      return NextResponse.json({
        items: [],
        counterparties: [],
        message: 'Нет потребностей за выбранный период',
      })
    }

    const categoryFilter = { OR: [{ category: DEFAULT_CATEGORY }, { category: null }] }

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

    // Загружаем ВСЕ строки прайсов (с masterItemId и без) — как в таблице 3 (price-comparison)
    const [assignments, ownPriceLists] = await Promise.all([
      prisma.priceAssignment.findMany({
        where: {
          counterpartyBusinessId: businessId,
          status: 'ACTIVE',
          priceList: categoryFilter,
        },
        include: {
          priceList: {
            include: {
              business: { select: { id: true, legalName: true, name: true } },
              rows: { select: { masterItemId: true, name: true, priceWithVat: true, priceWithoutVat: true } },
            },
          },
        },
      }),
      prisma.priceList.findMany({
        where: { businessId, kind: 'BASE', ...categoryFilter },
        include: {
          rows: { select: { masterItemId: true, name: true, priceWithVat: true, priceWithoutVat: true } },
        },
      }),
    ])

    const masterToOffers = new Map<string, Map<string, { price: number; legalName: string }>>()
    const normTitleToOffers = new Map<string, Map<string, { price: number; legalName: string }>>()
    const counterpartySet = new Map<string, string>()

    for (const a of assignments) {
      const supplierId = a.priceList.business.id
      const legalName = (a.priceList.business.legalName || '').trim() || a.priceList.business.name
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

    for (const a of assignments) {
      const supplierId = a.priceList.business.id
      const legalName = (a.priceList.business.legalName || '').trim() || a.priceList.business.name
      for (const row of a.priceList.rows) {
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
      }
    }

    const partnerCounterparties = Array.from(counterpartySet.entries())
      .filter(([id]) => id !== '__OWN_PRICE__')
      .map(([id, legalName]) => ({ id, legalName }))
      .sort((a, b) => a.legalName.localeCompare(b.legalName, 'ru'))
    const counterparties = hasOwnPrice
      ? [{ id: '__OWN_PRICE__', legalName: 'Мой прайс' }, ...partnerCounterparties]
      : partnerCounterparties

    const masterToCanonical = new Map<string, string>()
    for (const item of catalogItems) {
      masterToCanonical.set(item.id, item.canonicalName)
    }

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
      // Только позиции номенклатуры: пропускаем комментарии (Бар Банан, Войкова, КММ кухня и т.д.)
      if (!masterItemId) continue

      const canonicalName = masterToCanonical.get(masterItemId) ?? it.name

      const offers: Record<string, number> = {}
      const bySupplier = masterToOffers.get(masterItemId)
      if (bySupplier) {
        for (const [sid, { price }] of bySupplier) {
          offers[sid] = price
        }
      }
      if (Object.keys(offers).length === 0 && norm) {
        const byNorm = normTitleToOffers.get(norm)
        if (byNorm) {
          for (const [sid, { price }] of byNorm) {
            offers[sid] = price
          }
        }
      }

      resultItems.push({
        name: canonicalName,
        ...(canonicalName !== it.name && { originalName: it.name }),
        masterItemId,
        quantity: it.quantity,
        unit: it.unit,
        offers,
        analogues: {},
      })
    }

    return NextResponse.json({
      items: resultItems,
      counterparties,
    })
  } catch (error) {
    console.error('Period summary error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
