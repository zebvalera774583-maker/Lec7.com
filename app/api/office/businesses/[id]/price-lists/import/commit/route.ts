import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { getBusinessIdFromPath } from '@/lib/price-import'

const withOfficeAuth = (handler: (req: NextRequest, user: { id: string; role: string }) => Promise<NextResponse>) =>
  requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

export const POST = withOfficeAuth(async (req: NextRequest, user) => {
  try {
    const pathname = new URL(req.url).pathname
    const businessId = getBusinessIdFromPath(pathname)
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
    const { name, items } = body

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'items обязателен и должен быть массивом' }, { status: 400 })
    }

    // Filter: only items with title
    const validItems = items.filter(
      (it: { title?: string }) => it && typeof it.title === 'string' && it.title.trim().length > 0
    )
    if (validItems.length === 0) {
      return NextResponse.json({ error: 'Нет позиций для импорта' }, { status: 400 })
    }

    const priceListName =
      name && typeof name === 'string' && name.trim()
        ? name.trim()
        : `Импорт прайса (${new Date().toISOString().slice(0, 16).replace('T', ' ')})`

    const result = await prisma.$transaction(async (tx) => {
      const mappedRows = validItems.map(
        (
          it: {
            title: string
            price?: number | null
            priceWithVat?: number | null
            priceWithoutVat?: number | null
            unit?: string | null
            sku?: string | null
          },
          index: number
        ) => {
          const priceWithVat =
            it.priceWithVat != null && typeof it.priceWithVat === 'number' && !Number.isNaN(it.priceWithVat)
              ? it.priceWithVat
              : null
          const priceWithoutVat =
            it.priceWithoutVat != null &&
            typeof it.priceWithoutVat === 'number' &&
            !Number.isNaN(it.priceWithoutVat)
              ? it.priceWithoutVat
              : null
          const fallbackPrice = it.price != null && typeof it.price === 'number' && !Number.isNaN(it.price) ? it.price : null
          const finalPriceWithVat = priceWithVat ?? (priceWithoutVat == null ? fallbackPrice : null)
          const finalPriceWithoutVat = priceWithoutVat ?? (priceWithVat == null ? fallbackPrice : null)
          const extra = it.sku && String(it.sku).trim() ? { sku: String(it.sku).trim() } : undefined
          return {
            order: index + 1,
            name: String(it.title).trim(),
            unit: it.unit && String(it.unit).trim() ? String(it.unit).trim() : null,
            priceWithVat: finalPriceWithVat,
            priceWithoutVat: finalPriceWithoutVat,
            extra,
          }
        }
      )

      const hasAnyPriceWithoutVat = mappedRows.some((r) => r.priceWithoutVat != null)
      const columns = hasAnyPriceWithoutVat
        ? [
            { id: 'name', title: 'Наименование', kind: 'text' },
            { id: 'unit', title: 'Ед. изм', kind: 'text' },
            { id: 'priceWithVat', title: 'Цена за ед. изм. С НДС', kind: 'number' },
            { id: 'priceWithoutVat', title: 'Цена за ед. изм. без НДС', kind: 'number' },
          ]
        : [
            { id: 'name', title: 'Наименование', kind: 'text' },
            { id: 'unit', title: 'Ед. изм', kind: 'text' },
            { id: 'priceWithVat', title: 'Цена за ед. изм. С НДС', kind: 'number' },
          ]

      const priceList = await tx.priceList.create({
        data: {
          businessId,
          name: priceListName,
          kind: 'BASE',
          category: null,
          columns,
        },
      })

      await tx.priceListRow.createMany({
        data: mappedRows.map((r) => ({
          priceListId: priceList.id,
          ...r,
          priceWithoutVat: hasAnyPriceWithoutVat ? r.priceWithoutVat : null,
        })),
      })

      return { priceListId: priceList.id, count: mappedRows.length }
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('Commit price import error:', err)
    return NextResponse.json({ error: 'Ошибка при создании прайса' }, { status: 500 })
  }
})
