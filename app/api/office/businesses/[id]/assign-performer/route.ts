import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'
import { getAppOrigin } from '@/lib/getAppOrigin'

const withOfficeAuth = (handler: any) => requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

const TOKEN_BYTES = 16
const PICKER_LABEL = 'Сборщик 1'

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

    const assignment = await prisma.requestAssignment.findFirst({
      where: {
        role: 'PICKER',
        request: { businessId },
      },
      include: { invite: true, request: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    })

    if (!assignment?.invite) {
      return NextResponse.json({ assignment: null, invite: null })
    }

    const origin = getAppOrigin(req)
    return NextResponse.json({
      assignment: { id: assignment.id, requestId: assignment.request.id, role: assignment.role },
      invite: {
        label: assignment.invite.label,
        url: `${origin}/pick/invite/${assignment.invite.token}`,
      },
    })
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

    // Ищем уже существующее назначение сборщика по заявке этого бизнеса
    const existing = await prisma.requestAssignment.findFirst({
      where: {
        role: 'PICKER',
        request: { businessId },
      },
      include: { invite: true, request: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const origin = getAppOrigin(req)

    if (existing?.invite) {
      return NextResponse.json({
        assignment: { id: existing.id, requestId: existing.request.id, role: existing.role },
        invite: {
          label: existing.invite.label,
          url: `${origin}/pick/invite/${existing.invite.token}`,
        },
      })
    }

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
      assignment: { id: assignment.id, requestId: assignment.requestId, role: assignment.role },
      invite: {
        label: PICKER_LABEL,
        url: `${origin}/pick/invite/${pickerInvite.token}`,
      },
    })
  } catch (error) {
    console.error('Business assign performer error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

