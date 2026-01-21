import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

// Доступ только для владельца Lec7 (LEC7_ADMIN)
const withAdminAuth = (handler: any) => requireRole(['LEC7_ADMIN'], handler)

export const GET = withAdminAuth(async () => {
  try {
    const generatedAt = new Date().toISOString()

    // Базовые агрегаты по бизнесам и пользователям
    const [businessTotal, businessActive, usersTotal] = await Promise.all([
      prisma.business.count(),
      prisma.business.count({
        where: { lifecycleStatus: 'ACTIVE' },
      }),
      prisma.user.count(),
    ])

    const businessesInactive = Math.max(businessTotal - businessActive, 0)

    return NextResponse.json({
      generatedAt,
      businesses: {
        total: businessTotal,
        active: businessActive,
        inactive: businessesInactive,
      },
      users: {
        total: usersTotal,
      },
    })
  } catch (error) {
    console.error('Agent context error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
})

