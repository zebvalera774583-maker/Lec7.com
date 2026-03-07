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

    const DEPT_ORDER = ['voikovo_kitchen', 'voikovo_bar', 'navaginskaya_kitchen', 'navaginskaya_bar', 'moremall_kitchen', 'moremall_bar'] as const
    const DEPT_LABELS: Record<string, string> = {
      voikovo_kitchen: 'Войково кухня',
      voikovo_bar: 'Войково бар',
      navaginskaya_kitchen: 'Навагин кухня',
      navaginskaya_bar: 'Навагин бар',
      moremall_kitchen: 'ММ кухня',
      moremall_bar: 'ММ бар',
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
        incomingRequest: { is: { department: { not: null } } },
      },
      select: {
        id: true,
        number: true,
        title: true,
        description: true,
        createdAt: true,
        incomingRequest: { select: { department: true, items: { orderBy: { sortOrder: 'asc' }, select: { name: true, quantity: true, unit: true } } } },
      },
    })

    type GroupKey = string
    const groups = new Map<GroupKey, { department: string; date: string; requestNumbers: number[]; agg: Map<string, { name: string; quantity: number; unit: string }> }>()

    function getRowsFromRequest(r: (typeof requests)[0]): { name: string; quantity: string; unit: string }[] {
      const ir = r.incomingRequest
      if (ir?.items?.length) {
        return ir.items.map((it) => ({ name: it.name, quantity: it.quantity, unit: it.unit }))
      }
      return parseMaxRequestToRows(r.title || '', r.description || '')
    }

    for (const r of requests) {
      const dept = r.incomingRequest?.department
      if (!dept || typeof dept !== 'string' || !dept.trim()) continue

      const dateStr = r.createdAt.toISOString().slice(0, 10)
      const groupKey = `${dateStr}|${dept}`

      let group = groups.get(groupKey)
      if (!group) {
        group = { department: dept, date: dateStr, requestNumbers: [], agg: new Map() }
        groups.set(groupKey, group)
      }

      if (r.number != null) group.requestNumbers.push(r.number)

      const rows = getRowsFromRequest(r)
      for (const row of rows) {
        const key = `${row.name.toLowerCase().trim()}|${row.unit}`
        const qty = parseFloat(row.quantity) || 0
        const existing = group.agg.get(key)
        if (existing) {
          existing.quantity += qty
        } else {
          group.agg.set(key, { name: row.name.trim(), quantity: qty, unit: row.unit })
        }
      }
    }

    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      const orderA = DEPT_ORDER.indexOf(a.department as (typeof DEPT_ORDER)[number])
      const orderB = DEPT_ORDER.indexOf(b.department as (typeof DEPT_ORDER)[number])
      const idxA = orderA === -1 ? 999 : orderA
      const idxB = orderB === -1 ? 999 : orderB
      if (idxA !== idxB) return idxA - idxB
      return a.date.localeCompare(b.date)
    })

    if (sortedGroups.length === 0) {
      return NextResponse.json({
        sections: [],
        counterparties: [],
        message: 'Нет потребностей за выбранный период',
      })
    }

    const categoryFilter = { OR: [{ category: DEFAULT_CATEGORY }, { category: null }] }

    /** Fuzzy match: key from price list matches search norm (e.g. "кинза" matches "кинза свежая") */
    function normMatchesPriceKey(searchNorm: string, priceNorm: string): boolean {
      if (!searchNorm || !priceNorm) return false
      if (searchNorm === priceNorm) return true
      if (priceNorm.startsWith(searchNorm) || searchNorm.startsWith(priceNorm)) return true
      if (searchNorm.length >= 2 && (priceNorm.includes(searchNorm) || searchNorm.includes(priceNorm))) return true
      return false
    }

    const processGroupToResultItems = (
      requestItems: { name: string; quantity: string; unit: string }[],
      normToId: Map<string, string>,
      normToCanonical: Map<string, string>,
      masterToCanonical: Map<string, string>,
      masterToOffers: Map<string, Map<string, { price: number; legalName: string }>>,
      normTitleToOffers: Map<string, Map<string, { price: number; legalName: string }>>,
      supplierToRows: Map<string, { name: string; norm: string; price: number }[]>,
      counterparties: { id: string }[]
    ) => {
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
        const searchNorm = norm || normalizeForMatch(it.name)
        if (!searchNorm) continue

        const masterItemId = norm ? (normToId.get(norm) ?? null) : null
        const canonicalName = masterItemId ? (masterToCanonical.get(masterItemId) ?? it.name) : it.name

        const offers: Record<string, number> = {}

        // 1) By masterItemId (catalog-linked rows)
        if (masterItemId) {
          const bySupplier = masterToOffers.get(masterItemId)
          if (bySupplier) {
            for (const [sid, { price }] of bySupplier) offers[sid] = price
          }
        }

        // 2) By normTitleToOffers: exact + fuzzy (e.g. "кинза" → "кинза свежая")
        for (const [priceNorm, bySupplier] of normTitleToOffers) {
          if (!normMatchesPriceKey(searchNorm, priceNorm)) continue
          for (const [sid, { price }] of bySupplier) {
            const existing = offers[sid]
            if (existing == null || price < existing) offers[sid] = price
          }
        }

        // 3) Exact match from supplierToRows (row.norm === searchNorm) — прайс без masterItemId
        for (const c of counterparties) {
          const sid = c.id
          if (offers[sid] != null) continue
          const rows = supplierToRows.get(sid) || []
          for (const row of rows) {
            if (row.norm === searchNorm) {
              offers[sid] = row.price
              break
            }
          }
        }

        // 4) Analogues: fuzzy match when no exact price (e.g. "кинза" → "Кинза свежая")
        const analogues: Record<string, { name: string; price: number }[]> = {}
        if (searchNorm.length >= 2) {
          for (const c of counterparties) {
            const sid = c.id
            if (offers[sid] != null) continue
            const rows = supplierToRows.get(sid) || []
            const matches: { name: string; price: number }[] = []
            for (const row of rows) {
              if (row.norm === searchNorm) continue // exact already in offers
              if (row.norm.startsWith(searchNorm) || row.norm.includes(' ' + searchNorm) || (searchNorm.length >= 3 && row.norm.includes(searchNorm))) {
                matches.push({ name: row.name, price: row.price })
              }
            }
            matches.sort((a, b) => a.price - b.price)
            if (matches.length > 0) analogues[sid] = matches.slice(0, 5)
          }
        }

        // Include row if at least one offer or analogue (including items not in catalog)
        if (Object.keys(offers).length === 0 && Object.keys(analogues).length === 0) continue

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
    const supplierToRows = new Map<string, { name: string; norm: string; price: number }[]>()
    const counterpartySet = new Map<string, string>()

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

    const masterToCanonical = new Map<string, string>()
    for (const item of catalogItems) {
      masterToCanonical.set(item.id, item.canonicalName)
    }

    const sections = sortedGroups.map((group) => {
      const requestItems = Array.from(group.agg.values())
        .filter((it) => it.name.length > 0 && it.quantity > 0)
        .map((it) => ({ name: it.name, quantity: String(it.quantity), unit: it.unit }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

      const items = processGroupToResultItems(
        requestItems,
        normToId,
        normToCanonical,
        masterToCanonical,
        masterToOffers,
        normTitleToOffers,
        supplierToRows,
        counterparties
      )

      return {
        department: group.department,
        departmentLabel: DEPT_LABELS[group.department] ?? group.department,
        date: group.date,
        requestNumbers: [...new Set(group.requestNumbers)].sort((a, b) => a - b),
        items,
      }
    }).filter((s) => s.items.length > 0)

    return NextResponse.json({
      sections,
      counterparties,
    })
  } catch (error) {
    console.error('Period summary error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
