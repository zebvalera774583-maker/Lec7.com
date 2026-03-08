import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess } from '@/lib/access'
import { parsePriceValue } from '@/lib/parsePrice'
import { buildCatalogNormMap, normalizeForMatch } from '@/lib/catalog-match'

export const GET = withBusinessAccess(async (req, user) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]
    const priceId = pathParts[pathParts.indexOf('prices') + 1]

    if (!businessId || !priceId) {
      return NextResponse.json({ error: 'business id and price id are required' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Получаем прайс с строками и назначениями
    // Сначала ищем прайс, принадлежащий этому бизнесу
    let priceList = await prisma.priceList.findFirst({
      where: {
        id: priceId,
        businessId,
      },
      include: {
        rows: {
          orderBy: { order: 'asc' },
        },
        assignments: {
          include: {
            counterpartyBusiness: {
              include: {
                profile: {
                  select: {
                    residentNumber: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    // Если прайс не найден, проверяем, назначен ли он этому бизнесу (для просмотра назначенных прайсов)
    if (!priceList) {
      const assignment = await prisma.priceAssignment.findFirst({
        where: {
          priceListId: priceId,
          counterpartyBusinessId: businessId,
        },
        include: {
          priceList: {
            include: {
              rows: {
                orderBy: { order: 'asc' },
              },
              assignments: {
                include: {
                  counterpartyBusiness: {
                    include: {
                      profile: {
                        select: {
                          residentNumber: true,
                          displayName: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })

      if (assignment) {
        priceList = assignment.priceList
      }
    }

    if (!priceList) {
      return NextResponse.json({ error: 'Price list not found' }, { status: 404 })
    }

    // Формируем ответ
    const response = {
      id: priceList.id,
      name: priceList.name,
      kind: priceList.kind,
      category: priceList.category,
      derivedFromId: priceList.derivedFromId,
      modifierType: priceList.modifierType,
      percent: priceList.percent,
      columns: priceList.columns,
      rows: priceList.rows.map((row) => ({
        id: row.id,
        order: row.order,
        name: row.name,
        unit: row.unit,
        priceWithVat: row.priceWithVat,
        priceWithoutVat: row.priceWithoutVat,
        extra: row.extra,
      })),
      assignments: priceList.assignments.map((assignment) => ({
        id: assignment.id,
        counterpartyBusinessId: assignment.counterpartyBusinessId,
        counterpartyResidentNumber: assignment.counterpartyBusiness.profile?.residentNumber,
        counterpartyDisplayName: assignment.counterpartyBusiness.profile?.displayName,
        createdAt: assignment.createdAt,
      })),
      createdAt: priceList.createdAt,
      updatedAt: priceList.updatedAt,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Get price list error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

export const PUT = withBusinessAccess(async (req, user) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]
    const priceId = pathParts[pathParts.indexOf('prices') + 1]

    if (!businessId || !priceId) {
      return NextResponse.json({ error: 'business id and price id are required' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const body = await req.json()
    const { name, category, columns, rows } = body

    const catalogNormMap = rows?.length ? await buildCatalogNormMap() : null

    // Проверяем существование прайса
    const existingPrice = await prisma.priceList.findFirst({
      where: {
        id: priceId,
        businessId,
      },
    })

    if (!existingPrice) {
      return NextResponse.json({ error: 'Price list not found' }, { status: 404 })
    }

    // Обновляем прайс и строки в транзакции
    const result = await prisma.$transaction(async (tx) => {
      // Обновляем метаданные прайса
      const updatedPrice = await tx.priceList.update({
        where: { id: priceId },
        data: {
          ...(name !== undefined && { name }),
          ...(category !== undefined && { category: category || null }),
          ...(columns !== undefined && { columns }),
        },
      })

      // Удаляем старые строки
      await tx.priceListRow.deleteMany({
        where: { priceListId: priceId },
      })

      // Вставляем новые строки
      if (rows && Array.isArray(rows)) {
        await tx.priceListRow.createMany({
          data: rows.map((row: any, index: number) => {
            const normName = normalizeForMatch(row.name || '')
            const masterItemId = catalogNormMap && normName ? (catalogNormMap.get(normName) ?? null) : null
            return {
              priceListId: priceId,
              order: index + 1,
              name: row.name || '',
              unit: row.unit || null,
              priceWithVat: row.priceWithVat != null ? parsePriceValue(row.priceWithVat) : null,
              priceWithoutVat: row.priceWithoutVat != null ? parsePriceValue(row.priceWithoutVat) : null,
              extra: row.extra || null,
              masterItemId,
            }
          }),
        })
      }

      return updatedPrice
    })

    return NextResponse.json({ success: true, id: result.id })
  } catch (error: any) {
    console.error('Update price list error:', error)
    const errorMessage = error?.message || 'Internal Server Error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
})

export const DELETE = withBusinessAccess(async (req, user) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]
    const priceId = pathParts[pathParts.indexOf('prices') + 1]

    if (!businessId || !priceId) {
      return NextResponse.json({ error: 'business id and price id are required' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const priceList = await prisma.priceList.findFirst({
      where: { id: priceId, businessId },
    })

    if (!priceList) {
      return NextResponse.json({ error: 'Price list not found' }, { status: 404 })
    }

    await prisma.priceList.delete({ where: { id: priceId } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete price list error:', error)
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
})
