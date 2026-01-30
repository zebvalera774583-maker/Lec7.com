import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

const withOfficeAuth = (handler: any) => requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

export const GET = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const businessId = url.pathname.split('/').slice(-2, -1)[0] // /api/office/businesses/[id]/assigned-prices

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

    // Получаем назначенные этому бизнесу прайсы
    const assignments = await prisma.priceAssignment.findMany({
      where: {
        counterpartyBusinessId: businessId,
      },
      include: {
        priceList: {
          include: {
            business: {
              select: {
                id: true,
                legalName: true,
                name: true,
                slug: true,
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
      orderBy: {
        createdAt: 'desc',
      },
    })

    const result = assignments.map((assignment) => ({
      id: assignment.id,
      priceListId: assignment.priceList.id,
      priceName: assignment.priceList.name,
      priceKind: assignment.priceList.kind,
      priceModifierType: assignment.priceList.modifierType,
      pricePercent: assignment.priceList.percent,
      sourceBusinessId: assignment.priceList.business.id,
      sourceBusinessLegalName: assignment.priceList.business.legalName,
      sourceBusinessName: assignment.priceList.business.name,
      sourceBusinessSlug: assignment.priceList.business.slug,
      sourceBusinessDisplayName: assignment.priceList.business.profile?.displayName,
      sourceBusinessResidentNumber: assignment.priceList.business.profile?.residentNumber,
      assignedAt: assignment.createdAt,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get assigned prices error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
