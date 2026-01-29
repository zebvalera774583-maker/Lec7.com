import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

const withOfficeAuth = (handler: any) => requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

export const GET = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const businessId = url.pathname.split('/').slice(-2, -1)[0] // /api/office/businesses/[id]/prices

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    // Проверяем, что бизнес существует и принадлежит пользователю (или LEC7_ADMIN)
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Резидент может видеть только свой бизнес
    if (user.role !== 'LEC7_ADMIN' && business.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Получаем список прайсов
    const priceLists = await prisma.priceList.findMany({
      where: { businessId },
      select: {
        id: true,
        name: true,
        kind: true,
        derivedFromId: true,
        modifierType: true,
        percent: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            rows: true,
            assignments: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(priceLists)
  } catch (error) {
    console.error('Get price lists error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

// POST для создания нового прайса
export const POST = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const businessId = url.pathname.split('/').slice(-2, -1)[0] // /api/office/businesses/[id]/prices

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    // Проверяем, что бизнес существует и принадлежит пользователю (или LEC7_ADMIN)
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Резидент может изменять только свой бизнес
    if (user.role !== 'LEC7_ADMIN' && business.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { name, kind, derivedFromId, modifierType, percent, columns, rows } = body

    // Создаём прайс в транзакции
    const result = await prisma.$transaction(async (tx) => {
      const priceList = await tx.priceList.create({
        data: {
          businessId,
          name: name || 'Прайс 1',
          kind: (kind || 'BASE') as 'BASE' | 'DERIVED',
          derivedFromId: derivedFromId || null,
          modifierType: modifierType ? (modifierType as 'MARKUP' | 'DISCOUNT') : null,
          percent: percent || null,
          columns: columns || null,
        },
      })

      // Если есть строки, создаём их
      if (rows && Array.isArray(rows) && rows.length > 0) {
        const rowsToCreate = rows.map((row: any, index: number) => {
          let priceWithVatNum: number | null = null
          let priceWithoutVatNum: number | null = null

          if (row.priceWithVat && String(row.priceWithVat).trim() !== '') {
            const parsed = parseFloat(String(row.priceWithVat))
            if (!isNaN(parsed)) {
              priceWithVatNum = parsed
            }
          }

          if (row.priceWithoutVat && String(row.priceWithoutVat).trim() !== '') {
            const parsed = parseFloat(String(row.priceWithoutVat))
            if (!isNaN(parsed)) {
              priceWithoutVatNum = parsed
            }
          }

          return {
            priceListId: priceList.id,
            order: index + 1,
            name: row.name || '',
            unit: row.unit || null,
            priceWithVat: priceWithVatNum,
            priceWithoutVat: priceWithoutVatNum,
            extra: row.extra || null,
          }
        })

        if (rowsToCreate.length > 0) {
          await tx.priceListRow.createMany({
            data: rowsToCreate,
          })
        }
      }

      return priceList
    })

    return NextResponse.json({ success: true, id: result.id })
  } catch (error: any) {
    console.error('Create price list error:', error)
    const errorMessage = error?.message || 'Internal Server Error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
})
