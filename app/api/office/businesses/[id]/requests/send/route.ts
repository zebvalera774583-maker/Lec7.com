import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'
import { Decimal } from '@prisma/client/runtime/library'

const withOfficeAuth = (handler: any) => requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

interface SendRequestItem {
  name: string
  quantity: string
  unit: string
  price: number
  sum: number
  sortOrder: number
}

export const POST = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true, legalName: true, name: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (user.role !== 'LEC7_ADMIN' && business.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const recipientBusinessId = body.recipientBusinessId
    const category = typeof body.category === 'string' ? body.category.trim() : null
    const total = body.total != null ? Number(body.total) : null
    const items = Array.isArray(body.items) ? body.items : []

    if (!recipientBusinessId || typeof recipientBusinessId !== 'string') {
      return NextResponse.json({ error: 'recipientBusinessId is required' }, { status: 400 })
    }

    const recipient = await prisma.business.findUnique({
      where: { id: recipientBusinessId },
      select: { id: true },
    })
    if (!recipient) {
      return NextResponse.json({ error: 'Recipient business not found' }, { status: 404 })
    }

    const mapped: SendRequestItem[] = items.map((it: { name?: unknown; quantity?: unknown; unit?: unknown; price?: unknown; sum?: unknown }, idx: number) => ({
      name: typeof it.name === 'string' ? it.name.trim() : '',
      quantity: typeof it.quantity === 'string' ? it.quantity : String(it.quantity ?? ''),
      unit: typeof it.unit === 'string' ? it.unit.trim() : '',
      price: typeof it.price === 'number' && Number.isFinite(it.price) ? it.price : (it.price != null ? Number(it.price) : 0),
      sum: typeof it.sum === 'number' && Number.isFinite(it.sum) ? it.sum : (it.sum != null ? Number(it.sum) : 0),
      sortOrder: idx,
    }))
    const requestItems = mapped.filter((it: SendRequestItem) => it.name.length > 0)

    const incomingRequest = await prisma.incomingRequest.create({
      data: {
        senderBusinessId: businessId,
        recipientBusinessId,
        category: category || null,
        total: total != null && Number.isFinite(total) ? new Decimal(total) : null,
        status: 'NEW',
        items: {
          create: requestItems.map((it) => ({
            name: it.name,
            quantity: it.quantity,
            unit: it.unit,
            price: new Decimal(it.price),
            sum: new Decimal(it.sum),
            sortOrder: it.sortOrder,
          })),
        },
      },
      include: {
        items: true,
      },
    })

    return NextResponse.json({
      id: incomingRequest.id,
      recipientBusinessId: incomingRequest.recipientBusinessId,
      createdAt: incomingRequest.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('Send request error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
