import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

// Доступ только для владельца Lec7 (LEC7_ADMIN)
const withOwnerAuth = (handler: any) => requireRole(['LEC7_ADMIN'], handler)

export const POST = withOwnerAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const businessId = url.pathname.split('/').slice(-2, -1)[0] // /api/owner/businesses/[id]/activate

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    // Проверяем, существует ли бизнес
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, lifecycleStatus: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Обновляем статус на ACTIVE
    await prisma.business.update({
      where: { id: businessId },
      data: {
        lifecycleStatus: 'ACTIVE',
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Owner business activate error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
