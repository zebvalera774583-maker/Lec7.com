import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess } from '@/lib/access'

export const GET = withBusinessAccess(async (req, user) => {
  try {
    const url = new URL(req.url)
    const businessId = url.pathname.split('/').slice(-2, -1)[0]

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

    // 1) Активные контрагенты, где мы получатель: кто нам назначил прайс и мы приняли
    const activeAsRecipient = await prisma.priceAssignment.findMany({
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

    // 2) Активные контрагенты, где мы отправитель: кому мы назначили прайс и они приняли
    const activeAsSender = await prisma.priceAssignment.findMany({
      where: {
        status: 'ACTIVE',
        priceList: {
          businessId,
        },
      },
      include: {
        counterpartyBusiness: {
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
    })

    // Уникализируем по partnerBusinessId (один контрагент = одна запись), объединяя обе стороны
    const activeCounterpartiesMap = new Map()
    activeAsRecipient.forEach((assignment) => {
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
    activeAsSender.forEach((assignment) => {
      const partnerBusinessId = assignment.counterpartyBusinessId
      if (!activeCounterpartiesMap.has(partnerBusinessId)) {
        const partner = assignment.counterpartyBusiness
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

    // Заявки из MAX (Telegram) — показываются в Потребности (без ARCHIVED)
    const maxRequests = await prisma.request.findMany({
      where: {
        businessId,
        source: 'max_integration',
        status: { not: 'ARCHIVED' },
      },
      orderBy: { number: 'asc' },
      select: {
        id: true,
        number: true,
        title: true,
        description: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      activeCounterparties: Array.from(activeCounterpartiesMap.values()),
      incomingRequests,
      maxRequests: maxRequests.map((r) => ({
        requestId: r.id,
        number: r.number,
        title: r.title,
        description: r.description,
        createdAt: r.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Get partnership data error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
