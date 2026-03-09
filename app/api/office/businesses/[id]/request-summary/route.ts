import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess } from '@/lib/access'
import {
  buildCatalogMaps,
  buildOfferMaps,
  processRequestItemsToResult,
  type RequestItem,
} from '@/lib/summary-pipeline'

const DEFAULT_CATEGORY = 'Свежая плодоовощная продукция'

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

    const requestItems: RequestItem[] = items
      .map((it: any) => ({
        name: typeof it.name === 'string' ? it.name.trim() : '',
        quantity: typeof it.quantity === 'string' ? it.quantity : String(it.quantity ?? ''),
        unit: typeof it.unit === 'string' ? it.unit.trim() : '',
      }))
      .filter((it: { name: string }) => it.name.length > 0)

    if (requestItems.length === 0) {
      return NextResponse.json({ error: 'Укажите хотя бы одну позицию с наименованием' }, { status: 400 })
    }

    const [catalogMaps, { offerMaps, counterparties }] = await Promise.all([
      buildCatalogMaps(),
      buildOfferMaps(businessId, categoryParam),
    ])

    const resultItems = processRequestItemsToResult(
      requestItems,
      catalogMaps,
      offerMaps,
      counterparties
    )

    return NextResponse.json({
      items: resultItems,
      counterparties,
    })
  } catch (error) {
    console.error('Request summary error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
