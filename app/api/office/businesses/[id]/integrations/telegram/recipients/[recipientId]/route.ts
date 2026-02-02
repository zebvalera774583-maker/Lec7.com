import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

const withOfficeAuth = (handler: (req: NextRequest, user: { id: string; role: string }) => Promise<NextResponse>) =>
  requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

export const PATCH = withOfficeAuth(async (req: NextRequest, user: { id: string; role: string }) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]
    const recipientId = pathParts[pathParts.indexOf('recipients') + 1]

    if (!businessId || !recipientId) {
      return NextResponse.json({ error: 'business id and recipient id required' }, { status: 400 })
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

    const body = await req.json().catch(() => ({}))
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : undefined

    if (isActive === undefined) {
      return NextResponse.json({ error: 'isActive boolean required' }, { status: 400 })
    }

    const recipient = await prisma.businessTelegramRecipient.findFirst({
      where: { id: recipientId, businessId },
    })

    if (!recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
    }

    await prisma.businessTelegramRecipient.update({
      where: { id: recipientId },
      data: { isActive },
    })

    return NextResponse.json({ ok: true, isActive })
  } catch (error) {
    console.error('Telegram recipient PATCH error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
