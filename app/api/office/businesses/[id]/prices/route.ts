import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

const withOfficeAuth = (handler: any) => requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

// POST для создания нового прайса
export const POST = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const businessId = url.pathname.split('/').slice(-2, -1)[0]

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const body = await req.json()
    const { name, kind, derivedFromId, modifierType, percent, columns, rows } = body

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

    // Создаём прайс в транзакции
    const result = await prisma.$transaction(async (tx) => {
      const priceList = await tx.priceList.create({
        data: {
          businessId,
          name: name || 'Прайс 1',
          kind: kind || 'BASE',
          derivedFromId: derivedFromId || null,
          modifierType: modifierType || null,
          percent: percent || null,
          columns: columns || null,
        },
      })

      // Если есть строки, создаём их
      if (rows && Array.isArray(rows) && rows.length > 0) {
        await tx.priceListRow.createMany({
          data: rows.map((row: any, index: number) => ({
            priceListId: priceList.id,
            order: index + 1,
            name: row.name || '',
            unit: row.unit || null,
            priceWithVat: row.priceWithVat ? parseFloat(String(row.priceWithVat)) : null,
            priceWithoutVat: row.priceWithoutVat ? parseFloat(String(row.priceWithoutVat)) : null,
            extra: row.extra || null,
          })),
        })
      }

      return priceList
    })

    return NextResponse.json({ success: true, id: result.id })
  } catch (error) {
    console.error('Create price list error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
