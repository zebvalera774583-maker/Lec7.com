import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

const withOfficeAuth = (handler: any) => requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

export const POST = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]
    const linkId = pathParts[pathParts.length - 1] // Последний элемент пути

    if (!businessId || !linkId) {
      return NextResponse.json({ error: 'business id and link id are required' }, { status: 400 })
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
    const { action } = body

    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json({ error: 'action must be "accept" or "decline"' }, { status: 400 })
    }

    // Проверяем, что заявка существует и относится к текущему бизнесу как входящая
    const assignment = await prisma.priceAssignment.findUnique({
      where: { id: linkId },
      include: {
        priceList: {
          select: {
            businessId: true,
          },
        },
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Проверяем, что это входящая заявка (counterpartyBusinessId === currentBusinessId)
    if (assignment.counterpartyBusinessId !== businessId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Проверяем, что статус PENDING
    if (assignment.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request is not pending' }, { status: 409 })
    }

    // Обновляем статус
    const newStatus = action === 'accept' ? 'ACTIVE' : 'DECLINED'
    await prisma.priceAssignment.update({
      where: { id: linkId },
      data: {
        status: newStatus,
        respondedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Process partnership request error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
