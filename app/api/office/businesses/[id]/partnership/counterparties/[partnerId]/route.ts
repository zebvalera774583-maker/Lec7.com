import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

const withOfficeAuth = (handler: any) => requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

function parseIds(pathname: string): { businessId: string | null; partnerBusinessId: string | null } {
  const parts = pathname.split('/')
  const idx = parts.indexOf('businesses')
  if (idx === -1 || idx + 1 >= parts.length) {
    return { businessId: null, partnerBusinessId: null }
  }
  const businessId = parts[idx + 1] || null
  // Последний сегмент пути — это partnerId: /api/office/businesses/[id]/partnership/counterparties/[partnerId]
  const partnerBusinessId = parts[parts.length - 1] || null
  return { businessId, partnerBusinessId }
}

export const DELETE = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const { businessId, partnerBusinessId } = parseIds(new URL(req.url).pathname)

    if (!businessId || !partnerBusinessId) {
      return NextResponse.json({ error: 'businessId and partnerBusinessId are required' }, { status: 400 })
    }

    // Проверяем, что бизнес существует и принадлежит пользователю (или LEC7_ADMIN)
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

    // Переводим все активные связи между бизнесами в DECLINED (в обе стороны)
    await prisma.priceAssignment.updateMany({
      where: {
        status: 'ACTIVE',
        OR: [
          {
            counterpartyBusinessId: partnerBusinessId,
            priceList: { businessId },
          },
          {
            counterpartyBusinessId: businessId,
            priceList: { businessId: partnerBusinessId },
          },
        ],
      },
      data: {
        status: 'DECLINED',
        respondedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete partnership counterparty error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

