import { NextResponse } from 'next/server'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess, getBusinessIdFromPath } from '@/lib/access'

/**
 * PUT /api/office/businesses/[id]/request/[requestId]/items
 * Обновление позиций заявки (потребностей).
 * Body: { items: [{ id?: string, name: string, quantity: string, unit: string }] }
 * Если IncomingRequest нет — создаётся (для legacy заявок из description).
 */
export const PUT = withBusinessAccess(async (req, user) => {
  try {
    const pathname = new URL(req.url).pathname
    const businessId = getBusinessIdFromPath(pathname)
    const pathParts = pathname.split('/')
    const requestIdx = pathParts.indexOf('request')
    const requestId = requestIdx >= 0 && requestIdx + 1 < pathParts.length ? pathParts[requestIdx + 1] : null

    if (!businessId || !requestId) {
      return NextResponse.json({ error: 'Business ID and Request ID are required' }, { status: 400 })
    }

    const body = await req.json()
    const rawItems = Array.isArray(body?.items) ? body.items : []
    const items = rawItems
      .map((it: unknown) => {
        if (it && typeof it === 'object' && 'name' in it) {
          const name = String((it as { name?: unknown }).name ?? '').trim()
          const quantity = String((it as { quantity?: unknown }).quantity ?? '1').trim()
          const unit = String((it as { unit?: unknown }).unit ?? 'шт').trim()
          if (name) return { name, quantity, unit }
        }
        return null
      })
      .filter(Boolean) as { name: string; quantity: string; unit: string }[]

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { id: true, businessId: true },
    })

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (request.businessId !== businessId) {
      return NextResponse.json({ error: 'Request does not belong to this business' }, { status: 403 })
    }

    const incoming = await prisma.incomingRequest.findFirst({
      where: { requestId },
      select: { id: true },
    })

    const needText = items.map((i) => `${i.name} ${i.quantity} ${i.unit}`.trim()).join(', ')

    if (incoming) {
      await prisma.$transaction([
        prisma.incomingRequestItem.deleteMany({ where: { requestId: incoming.id } }),
        ...items.map((it, i) =>
          prisma.incomingRequestItem.create({
            data: {
              requestId: incoming.id,
              name: it.name,
              quantity: it.quantity,
              unit: it.unit,
              price: new Decimal(0),
              sum: new Decimal(0),
              sortOrder: i,
            },
          })
        ),
      ])
    } else {
      await prisma.$transaction(async (tx) => {
        const inc = await tx.incomingRequest.create({
          data: {
            senderBusinessId: businessId,
            recipientBusinessId: businessId,
            requestId,
            items: {
              create: items.map((it, i) => ({
                name: it.name,
                quantity: it.quantity,
                unit: it.unit,
                price: new Decimal(0),
                sum: new Decimal(0),
                sortOrder: i,
              })),
            },
          },
        })
        return inc
      })
    }

    await prisma.request.update({
      where: { id: requestId },
      data: {
        title: `Заявка из MAX: ${needText.slice(0, 80) || 'Новое сообщение'}`,
        description: needText,
      },
    })

    return NextResponse.json({ ok: true, items })
  } catch (error) {
    console.error('Update request items error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
