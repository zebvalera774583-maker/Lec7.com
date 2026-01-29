import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

const withOfficeAuth = (handler: any) => requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

export const GET = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]
    const priceId = pathParts[pathParts.indexOf('prices') + 1]

    if (!businessId || !priceId) {
      return NextResponse.json({ error: 'business id and price id are required' }, { status: 400 })
    }

    // Проверяем доступ
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

    // Получаем прайс с строками и назначениями
    const priceList = await prisma.priceList.findFirst({
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

    if (!priceList) {
      return NextResponse.json({ error: 'Price list not found' }, { status: 404 })
    }

    // Формируем ответ
    const response = {
      id: priceList.id,
      name: priceList.name,
      kind: priceList.kind,
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

export const PUT = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]
    const priceId = pathParts[pathParts.indexOf('prices') + 1]

    if (!businessId || !priceId) {
      return NextResponse.json({ error: 'business id and price id are required' }, { status: 400 })
    }

    const body = await req.json()
    const { name, columns, rows } = body

    // Проверяем доступ
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
          data: rows.map((row: any, index: number) => ({
            priceListId: priceId,
            order: index + 1,
            name: row.name || '',
            unit: row.unit || null,
            priceWithVat: row.priceWithVat ? parseFloat(String(row.priceWithVat)) : null,
            priceWithoutVat: row.priceWithoutVat ? parseFloat(String(row.priceWithoutVat)) : null,
            extra: row.extra || null,
          })),
        })
      }

      return updatedPrice
    })

    return NextResponse.json({ success: true, id: result.id })
  } catch (error) {
    console.error('Update price list error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
