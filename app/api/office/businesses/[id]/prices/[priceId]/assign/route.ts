import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

const withOfficeAuth = (handler: any) => requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

export const POST = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]
    const priceId = pathParts[pathParts.indexOf('prices') + 1]

    if (!businessId || !priceId) {
      return NextResponse.json({ error: 'business id and price id are required' }, { status: 400 })
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
    const { residentNumber } = body

    if (!residentNumber || typeof residentNumber !== 'string') {
      return NextResponse.json({ error: 'residentNumber is required' }, { status: 400 })
    }

    // Валидация формата
    const pattern = /^L7-[A-Z0-9]{8}$/
    if (!pattern.test(residentNumber.trim().toUpperCase())) {
      return NextResponse.json({ error: 'Invalid resident number format' }, { status: 400 })
    }

    // Проверяем существование прайса
    const priceList = await prisma.priceList.findFirst({
      where: {
        id: priceId,
        businessId,
      },
    })

    if (!priceList) {
      return NextResponse.json({ error: 'Price list not found' }, { status: 404 })
    }

    // Находим контрагента по residentNumber
    const counterpartyProfile = await prisma.businessProfile.findUnique({
      where: {
        residentNumber: residentNumber.trim().toUpperCase(),
      },
      include: {
        business: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!counterpartyProfile || !counterpartyProfile.business) {
      return NextResponse.json({ error: 'Counterparty not found' }, { status: 404 })
    }

    const counterpartyBusinessId = counterpartyProfile.business.id

    // Проверяем, что не назначаем самому себе
    if (counterpartyBusinessId === businessId) {
      return NextResponse.json({ error: 'Cannot assign price to own business' }, { status: 400 })
    }

    // Создаём назначение (upsert для идемпотентности)
    // Новые связи создаются со статусом PENDING (требуют подтверждения)
    // Если заявка уже существует, но была отклонена или принята, сбрасываем на PENDING (повторное назначение)
    const assignment = await prisma.priceAssignment.upsert({
      where: {
        priceListId_counterpartyBusinessId: {
          priceListId: priceId,
          counterpartyBusinessId,
        },
      },
      create: {
        priceListId: priceId,
        counterpartyBusinessId,
        status: 'PENDING',
      },
      update: {
        status: 'PENDING', // При повторном назначении сбрасываем статус на PENDING
        respondedAt: null, // Сбрасываем дату ответа
      },
    })

    // Возвращаем обновлённый список назначений
    const assignments = await prisma.priceAssignment.findMany({
      where: { priceListId: priceId },
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
    })

    return NextResponse.json({
      success: true,
      assignments: assignments.map((a) => ({
        id: a.id,
        counterpartyBusinessId: a.counterpartyBusinessId,
        counterpartyResidentNumber: a.counterpartyBusiness.profile?.residentNumber,
        counterpartyDisplayName: a.counterpartyBusiness.profile?.displayName,
        createdAt: a.createdAt,
      })),
    })
  } catch (error: any) {
    console.error('Assign counterparty error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Already assigned' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

export const DELETE = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]
    const priceId = pathParts[pathParts.indexOf('prices') + 1]

    if (!businessId || !priceId) {
      return NextResponse.json({ error: 'business id and price id are required' }, { status: 400 })
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

    const searchParams = url.searchParams
    const residentNumber = searchParams.get('residentNumber')

    if (!residentNumber) {
      return NextResponse.json({ error: 'residentNumber is required' }, { status: 400 })
    }

    // Находим контрагента
    const counterpartyProfile = await prisma.businessProfile.findUnique({
      where: {
        residentNumber: residentNumber.trim().toUpperCase(),
      },
      include: {
        business: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!counterpartyProfile || !counterpartyProfile.business) {
      return NextResponse.json({ error: 'Counterparty not found' }, { status: 404 })
    }

    // Удаляем назначение
    await prisma.priceAssignment.deleteMany({
      where: {
        priceListId: priceId,
        counterpartyBusinessId: counterpartyProfile.business.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove assignment error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
