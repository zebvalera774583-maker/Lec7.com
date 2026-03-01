import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess } from '@/lib/access'

const DEFAULT_CATEGORY = 'Свежая плодоовощная продукция'

function normalizeForMatch(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
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

    // 2) Load accepted prices (same logic as price-comparison)
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
              rows: { where: { masterItemId: { not: null } }, select: { masterItemId: true, priceWithVat: true, priceWithoutVat: true } },
            },
          },
        },
      }),
      prisma.priceList.findMany({
        where: { businessId, kind: 'BASE', ...categoryFilter },
        include: {
          rows: { where: { masterItemId: { not: null } }, select: { masterItemId: true, priceWithVat: true, priceWithoutVat: true } },
        },
      }),
    ])

    // 3) Build masterItemId -> { supplierId -> minPrice }
    const masterToOffers = new Map<string, Map<string, { price: number; legalName: string }>>()
    const counterpartySet = new Map<string, string>()

    const addOffer = (masterItemId: string, supplierId: string, legalName: string, price: number) => {
      let bySupplier = masterToOffers.get(masterItemId)
      if (!bySupplier) {
        bySupplier = new Map()
        masterToOffers.set(masterItemId, bySupplier)
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
        if (!row.masterItemId) continue
        const price = row.priceWithVat != null
          ? Number(row.priceWithVat)
          : row.priceWithoutVat != null
            ? Number(row.priceWithoutVat)
            : null
        if (price == null || Number.isNaN(price)) continue
        addOffer(row.masterItemId, supplierId, legalName, price)
      }
    }

    const hasOwnPrice = ownPriceLists.length > 0
    for (const pl of ownPriceLists) {
      const supplierId = '__OWN_PRICE__'
      const legalName = 'Мой прайс'
      for (const row of pl.rows) {
        if (!row.masterItemId) continue
        const price = row.priceWithVat != null
          ? Number(row.priceWithVat)
          : row.priceWithoutVat != null
            ? Number(row.priceWithoutVat)
            : null
        if (price == null || Number.isNaN(price)) continue
        addOffer(row.masterItemId, supplierId, legalName, price)
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
      if (masterItemId) {
        const bySupplier = masterToOffers.get(masterItemId)
        if (bySupplier) {
          for (const [sid, { price }] of bySupplier) {
            offers[sid] = price
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
        analogues: {}, // No analogues for master-catalog flow
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
