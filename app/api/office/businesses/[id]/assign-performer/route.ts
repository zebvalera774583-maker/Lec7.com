import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

const withOfficeAuth = (handler: (req: NextRequest, user: { id: string; role: string }) => Promise<NextResponse>) =>
  requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

const TOKEN_BYTES = 24
const PICKER_LABEL = 'Сборщик 1'

function getAppOrigin(req: NextRequest): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (base) return base.replace(/\/$/, '')
  const host = req.headers.get('host')
  const proto =
    req.headers.get('x-forwarded-proto') ||
    req.headers.get('x-forwarded-protocol') ||
    (req.url.startsWith('https') ? 'https' : 'http')
  return host ? `${proto}://${host}` : 'http://localhost:3000'
}

function getBusinessIdFromPath(pathname: string): string | null {
  // /api/office/businesses/[id]/assign-performer
  const parts = pathname.split('/')
  const idx = parts.indexOf('businesses')
  if (idx === -1 || idx + 1 >= parts.length) return null
  const id = parts[idx + 1]
  return id && id !== 'assign-performer' ? id : null
}

async function ensureBusinessAccessible(businessId: string, user: { id: string; role: string }) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true },
  })
  if (!business) {
    return { error: NextResponse.json({ error: 'Business not found' }, { status: 404 }) }
  }
  if (user.role !== 'LEC7_ADMIN' && business.ownerId !== user.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { business }
}

export const GET = withOfficeAuth(async (req: NextRequest, user: { id: string; role: string }) => {
  try {
    const businessId = getBusinessIdFromPath(new URL(req.url).pathname)
    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const access = await ensureBusinessAccessible(businessId, user)
    if ('error' in access && access.error) return access.error

    const assignments = await prisma.requestAssignment.findMany({
      where: {
        role: 'PICKER',
        request: { businessId },
        invite: { revokedAt: null },
      },
      include: { invite: true, request: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const origin = getAppOrigin(req)
    const pickers = assignments
      .filter((a) => a.invite)
      .map((a) => ({
        assignmentId: a.id,
        requestId: a.request.id,
        inviteId: a.invite!.id,
        label: a.invite!.label,
        createdAt: a.invite!.createdAt,
        usedAt: a.invite!.usedAt,
        revokedAt: a.invite!.revokedAt,
        url: `${origin}/pick/invite/${a.invite!.token}`,
      }))

    return NextResponse.json({ pickers })
  } catch (error) {
    console.error('Get business assign performer error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

export const POST = withOfficeAuth(async (req: NextRequest, user: { id: string; role: string }) => {
  try {
    const businessId = getBusinessIdFromPath(new URL(req.url).pathname)
    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const access = await ensureBusinessAccessible(businessId, user)
    if ('error' in access && access.error) return access.error

    const body = await req.json().catch(() => ({}))
    const role = body?.role === 'PICKER' ? 'PICKER' : null
    if (!role) {
      return NextResponse.json({ error: 'role PICKER is required' }, { status: 400 })
    }

    const origin = getAppOrigin(req)

    // Берём последнюю заявку бизнеса или создаём новую «техническую» заявку
    let request = await prisma.request.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })

    if (!request) {
      request = await prisma.request.create({
        data: {
          businessId,
          title: 'Заявка со страницы Партнёрства',
          description: 'Автоматически создана для назначения исполнителя (сборщика).',
          source: 'partnership_assign_picker',
        },
        select: { id: true },
      })
    }

    const token = randomBytes(TOKEN_BYTES).toString('hex')
    const pickerInvite = await prisma.pickerInvite.create({
      data: {
        token,
        label: PICKER_LABEL,
        requestId: request.id,
        createdByUserId: user.id,
      },
    })

    const assignment = await prisma.requestAssignment.create({
      data: {
        requestId: request.id,
        role: 'PICKER',
        createdByUserId: user.id,
        inviteId: pickerInvite.id,
      },
    })

    return NextResponse.json({
      picker: {
        assignmentId: assignment.id,
        requestId: assignment.requestId,
        inviteId: pickerInvite.id,
        label: PICKER_LABEL,
        createdAt: pickerInvite.createdAt,
        usedAt: pickerInvite.usedAt,
        revokedAt: pickerInvite.revokedAt,
        url: `${origin}/pick/invite/${pickerInvite.token}`,
      },
    })
  } catch (error) {
    console.error('Business assign performer error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

export const DELETE = withOfficeAuth(async (req: NextRequest, user: { id: string; role: string }) => {
  try {
    const businessId = getBusinessIdFromPath(new URL(req.url).pathname)
    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const access = await ensureBusinessAccessible(businessId, user)
    if ('error' in access && access.error) return access.error

    const assignment = await prisma.requestAssignment.findFirst({
      where: {
        role: 'PICKER',
        request: { businessId },
        invite: { revokedAt: null },
      },
      include: { invite: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!assignment?.invite) {
      return NextResponse.json({ ok: true })
    }

    await prisma.pickerInvite.update({
      where: { id: assignment.invite.id },
      data: { revokedAt: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Business delete assign performer error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})


