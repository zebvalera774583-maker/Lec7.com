import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess } from '@/lib/access'

function parseIds(pathname: string): { businessId: string | null; partnerBusinessId: string | null } {
  const parts = pathname.split('/')
  const idx = parts.indexOf('businesses')
  if (idx === -1 || idx + 1 >= parts.length) {
    return { businessId: null, partnerBusinessId: null }
  }
  const businessId = parts[idx + 1] || null
  const partnerBusinessId = parts[parts.length - 1] || null
  return { businessId, partnerBusinessId }
}

export const DELETE = withBusinessAccess(async (req, user) => {
  try {
    const { businessId, partnerBusinessId } = parseIds(new URL(req.url).pathname)

    if (!businessId || !partnerBusinessId) {
      return NextResponse.json({ error: 'businessId and partnerBusinessId are required' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
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

