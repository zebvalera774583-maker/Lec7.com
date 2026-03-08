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

    // Активные контрагенты — из таблицы ActiveCounterparty (связь не привязана к прайсу, сохраняется при удалении)
    const [asBusiness, asCounterparty] = await Promise.all([
      prisma.activeCounterparty.findMany({
        where: { businessId },
        include: {
          counterpartyBusiness: {
            select: {
              id: true,
              legalName: true,
              name: true,
              slug: true,
              profile: { select: { residentNumber: true } },
            },
          },
        },
      }),
      prisma.activeCounterparty.findMany({
        where: { counterpartyBusinessId: businessId },
        include: {
          business: {
            select: {
              id: true,
              legalName: true,
              name: true,
              slug: true,
              profile: { select: { residentNumber: true } },
            },
          },
        },
      }),
    ])

    const activeCounterpartiesMap = new Map()
    asBusiness.forEach((ac) => {
      const partner = ac.counterpartyBusiness
      activeCounterpartiesMap.set(partner.id, {
        partnerBusinessId: partner.id,
        legalName: partner.legalName,
        name: partner.name,
        slug: partner.slug,
        residentNumber: partner.profile?.residentNumber || null,
      })
    })
    asCounterparty.forEach((ac) => {
      const partner = ac.business
      if (!activeCounterpartiesMap.has(partner.id)) {
        activeCounterpartiesMap.set(partner.id, {
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
        incomingRequest: { select: { department: true } },
      },
    })

    const DEPT_LABELS: Record<string, string> = {
      voikovo_kitchen: 'Войково кухня',
      voikovo_bar: 'Войково бар',
      navaginskaya_kitchen: 'Навагин кухня',
      navaginskaya_bar: 'Навагин бар',
      moremall_kitchen: 'ММ кухня',
      moremall_bar: 'ММ бар',
    }

    return NextResponse.json({
      activeCounterparties: Array.from(activeCounterpartiesMap.values()),
      incomingRequests,
      maxRequests: maxRequests.map((r) => ({
        requestId: r.id,
        number: r.number,
        title: r.title,
        description: r.description,
        createdAt: r.createdAt.toISOString(),
        department: r.incomingRequest?.department
          ? DEPT_LABELS[r.incomingRequest.department] ?? r.incomingRequest.department
          : null,
      })),
    })
  } catch (error) {
    console.error('Get partnership data error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
