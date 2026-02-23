import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess } from '@/lib/access'

export const GET = withBusinessAccess(async (req, user) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]

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

    const [incomingList, businessRequests] = await Promise.all([
      prisma.incomingRequest.findMany({
        where: { recipientBusinessId: businessId },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: { id: true, legalName: true, name: true },
          },
          request: {
            select: { id: true, number: true, createdAt: true },
          },
          items: { orderBy: { sortOrder: 'asc' } },
        },
      }),
      prisma.request.findMany({
        where: {
          businessId,
          source: { not: 'max_integration' },
        },
        orderBy: { number: 'asc' },
      }),
    ])

    const incomingMapped: Array<{
      id: string
      type: 'incoming' | 'request'
      requestId: string | null
      number: number | null
      senderBusinessId: string
      senderLegalName: string
      category: string | null
      total: number | null
      status: string
      createdAt: string
      items: { id: string; name: string; quantity: string; unit: string; price: number; sum: number }[]
    }> = []
    for (const r of incomingList) {
      if (r.requestId && r.request) {
        incomingMapped.push({
          id: `request_${r.request.id}`,
          type: 'request',
          requestId: r.request.id,
          number: r.request.number,
          senderBusinessId: '',
          senderLegalName: 'MAX',
          category: null,
          total: null,
          status: r.status,
          createdAt: r.request.createdAt.toISOString(),
          items: r.items.map((i) => ({
            id: i.id,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            price: Number(i.price),
            sum: Number(i.sum),
          })),
        })
      } else {
        incomingMapped.push({
          id: r.id,
          type: 'incoming',
          requestId: null,
          number: null,
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
        })
      }
    }

    const requestMapped = businessRequests.map((r) => ({
      id: `request_${r.id}`,
      type: 'request' as const,
      requestId: r.id,
      number: r.number,
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

    const requests = [...incomingMapped, ...requestMapped].sort((a, b) => {
      const na = a.number ?? 999999999
      const nb = b.number ?? 999999999
      return na - nb
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Incoming requests error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
