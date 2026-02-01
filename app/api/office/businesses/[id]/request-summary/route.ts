import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

const withOfficeAuth = (handler: any) => requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/[.,;:()\[\]{}"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export const POST = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (user.role !== 'LEC7_ADMIN' && business.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const items = Array.isArray(body.items) ? body.items : []
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

    // Активные назначения: контрагенты, которые нам назначили прайс (мы получатель)
    const assignments = await prisma.priceAssignment.findMany({
      where: {
        counterpartyBusinessId: businessId,
        status: 'ACTIVE',
      },
      include: {
        priceList: {
          include: {
            business: {
              select: { id: true, legalName: true, name: true },
            },
            rows: true,
          },
        },
      },
    })

    // По нормализованному названию — список предложений: { supplierBusinessId, supplierLegalName, price }
    const normToOffers = new Map<string, { supplierBusinessId: string; supplierLegalName: string; price: number }[]>()
    const counterpartySet = new Map<string, string>()

    for (const a of assignments) {
      const supplierId = a.priceList.business.id
      const supplierName = (a.priceList.business.legalName || '').trim() || a.priceList.business.name
      counterpartySet.set(supplierId, supplierName)

      for (const row of a.priceList.rows) {
        const norm = normalizeName(row.name)
        if (!norm) continue
        const price = row.priceWithVat != null
          ? Number(row.priceWithVat)
          : row.priceWithoutVat != null
            ? Number(row.priceWithoutVat)
            : null
        if (price == null || Number.isNaN(price)) continue

        const list = normToOffers.get(norm) || []
        list.push({ supplierBusinessId: supplierId, supplierLegalName: supplierName, price })
        normToOffers.set(norm, list)
      }
    }

    const counterparties = Array.from(counterpartySet.entries())
      .map(([id, legalName]) => ({ id, legalName }))
      .sort((a, b) => a.legalName.localeCompare(b.legalName, 'ru'))

    const resultItems: {
      name: string
      quantity: string
      unit: string
      offers: Record<string, number>
    }[] = []

    for (const it of requestItems) {
      const norm = normalizeName(it.name)
      const offersList = norm ? normToOffers.get(norm) || [] : []
      const offers: Record<string, number> = {}
      for (const o of offersList) {
        offers[o.supplierBusinessId] = o.price
      }
      resultItems.push({
        name: it.name,
        quantity: it.quantity,
        unit: it.unit,
        offers,
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
