import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'
import { requireAuth } from './middleware'
import type { AuthUser } from '@/types'
import type { RequestWithAuth } from './middleware'

/**
 * Извлекает businessId из URL path /api/office/businesses/[id]/...
 */
export function getBusinessIdFromPath(pathname: string): string | null {
  const parts = pathname.split('/')
  const idx = parts.indexOf('businesses')
  if (idx === -1 || idx + 1 >= parts.length) return null
  return parts[idx + 1] || null
}

/**
 * Проверяет, имеет ли пользователь доступ к бизнесу.
 * Доступ есть, если: owner бизнеса, или ReceiverMembership, или LEC7_ADMIN.
 * LEC7_ADMIN всегда проходит без проверки membership.
 */
export async function requireBusinessAccess(
  businessId: string,
  userId: string,
  userRole: string
): Promise<boolean> {
  if (userRole === 'LEC7_ADMIN') {
    return true
  }

  const [business, membership] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    }),
    prisma.receiverMembership.findUnique({
      where: { userId_businessId: { userId, businessId } },
      select: { id: true },
    }),
  ])

  if (!business) {
    return false
  }

  if (business.ownerId === userId) {
    return true
  }

  if (membership) {
    return true
  }

  return false
}

/**
 * Обёртка: requireAuth + requireBusinessAccess.
 * Заменяет requireRole(['BUSINESS_OWNER','LEC7_ADMIN']) для office/businesses API.
 */
export function withBusinessAccess(
  handler: (req: RequestWithAuth, user: AuthUser) => Promise<NextResponse>
) {
  return requireAuth(async (req, user) => {
    const businessId = getBusinessIdFromPath(new URL(req.url).pathname)
    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const hasAccess = await requireBusinessAccess(businessId, user.id, user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return handler(req, user)
  })
}
