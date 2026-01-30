import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

const withOfficeAuth = (handler: any) => requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

export const GET = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const businessId = url.pathname.split('/').slice(-2, -1)[0] // /api/office/businesses/[id]/partnership

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

    // Получаем активные контрагенты (ACTIVE, где текущий бизнес - получатель)
    const activeAssignments = await prisma.priceAssignment.findMany({
      where: {
        counterpartyBusinessId: businessId,
        status: 'ACTIVE',
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
                  },
                },
              },
            },
          },
        },
      },
    })

    // Уникализируем по partnerBusinessId (один контрагент = одна запись)
    const activeCounterpartiesMap = new Map()
    activeAssignments.forEach((assignment) => {
      const partnerBusinessId = assignment.priceList.businessId
      if (!activeCounterpartiesMap.has(partnerBusinessId)) {
        const partner = assignment.priceList.business
        activeCounterpartiesMap.set(partnerBusinessId, {
          partnerBusinessId: partner.id,
          legalName: partner.legalName,
          name: partner.name,
          slug: partner.slug,
          residentNumber: partner.profile?.residentNumber || null,
        })
      }
    })

    // Получаем входящие заявки (PENDING, где текущий бизнес - получатель)
    const incomingAssignments = await prisma.priceAssignment.findMany({
      where: {
        counterpartyBusinessId: businessId,
        status: 'PENDING',
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

    const incomingRequests = incomingAssignments.map((assignment) => {
      const fromBusiness = assignment.priceList.business
      return {
        linkId: assignment.id,
        fromBusinessId: fromBusiness.id,
        fromLegalName: fromBusiness.legalName,
        fromName: fromBusiness.name,
        fromSlug: fromBusiness.slug,
        fromResidentNumber: fromBusiness.profile?.residentNumber || null,
        createdAt: assignment.createdAt,
      }
    })

    return NextResponse.json({
      activeCounterparties: Array.from(activeCounterpartiesMap.values()),
      incomingRequests,
    })
  } catch (error) {
    console.error('Get partnership data error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
