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

    const [incomingList, businessRequests] = await Promise.all([
      prisma.incomingRequest.findMany({
        where: { recipientBusinessId: businessId },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: { id: true, legalName: true, name: true },
          },
          items: { orderBy: { sortOrder: 'asc' } },
        },
      }),
      prisma.request.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const incomingMapped = incomingList.map((r) => ({
      id: r.id,
      type: 'incoming' as const,
      requestId: null as string | null,
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

    const requestMapped = businessRequests.map((r) => ({
      id: `request_${r.id}`,
      type: 'request' as const,
      requestId: r.id,
      senderBusinessId: '',
      senderLegalName: 'MAX',
      category: null,
      total: null,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      items: [{
        id: `${r.id}_item`,
        name: r.description || r.title,
        quantity: '1',
        unit: 'шт',
        price: 0,
        sum: 0,
      }],
    }))

    const requests = [...incomingMapped, ...requestMapped]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Incoming requests error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
