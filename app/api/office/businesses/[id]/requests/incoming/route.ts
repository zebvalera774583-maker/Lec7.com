import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

const withOfficeAuth = (handler: any) => requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

export const GET = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

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

    const list = await prisma.incomingRequest.findMany({
      where: { recipientBusinessId: businessId },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, legalName: true, name: true },
        },
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    const requests = list.map((r) => ({
      id: r.id,
      senderBusinessId: r.senderBusinessId,
      senderLegalName: r.sender.legalName || r.sender.name,
      category: r.category,
      total: r.total != null ? Number(r.total) : null,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      items: r.items.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        price: Number(i.price),
        sum: Number(i.sum),
      })),
    }))

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Incoming requests error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
