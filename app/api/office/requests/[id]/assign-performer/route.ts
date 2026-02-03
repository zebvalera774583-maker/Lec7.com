import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'
import { randomBytes } from 'crypto'

const withOfficeAuth = (handler: (req: NextRequest, user: { id: string; role: string }) => Promise<NextResponse>) =>
  requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

const TOKEN_BYTES = 24
const PICKER_LABEL = 'Сборщик 1'

function getAppOrigin(req: NextRequest): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (base) return base.replace(/\/$/, '')
  const host = req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || req.headers.get('x-forwarded-protocol') || (req.url.startsWith('https') ? 'https' : 'http')
  return host ? `${proto}://${host}` : 'http://localhost:3000'
}

function getRequestIdFromPath(pathname: string): string | null {
  const i = pathname.indexOf('/requests/')
  if (i === -1) return null
  const rest = pathname.slice(i + '/requests/'.length)
  const id = rest.split('/')[0]
  return id && id !== 'assign-performer' ? id : null
}

export const GET = withOfficeAuth(async (req: NextRequest, user: { id: string; role: string }) => {
  try {
    const requestId = getRequestIdFromPath(new URL(req.url).pathname)
    if (!requestId) {
      return NextResponse.json({ error: 'request id is required' }, { status: 400 })
    }
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { id: true, business: { select: { ownerId: true } } },
    })
    if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    if (user.role !== 'LEC7_ADMIN' && request.business?.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const assignment = await prisma.requestAssignment.findUnique({
      where: { requestId_role: { requestId, role: 'PICKER' } },
      include: { invite: true },
    })
    if (!assignment?.invite) {
      return NextResponse.json({ assignment: null, invite: null })
    }
    const origin = getAppOrigin(req)
    return NextResponse.json({
      assignment: { id: assignment.id, requestId: assignment.requestId, role: assignment.role },
      invite: {
        label: assignment.invite.label,
        url: `${origin}/pick/invite/${assignment.invite.token}`,
      },
    })
  } catch (error) {
    console.error('Get assign performer error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

export const POST = withOfficeAuth(async (req: NextRequest, user: { id: string; role: string }) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const requestId = pathParts[pathParts.indexOf('requests') + 1]
    if (!requestId || requestId === 'assign-performer') {
      return NextResponse.json({ error: 'request id is required' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const role = body?.role === 'PICKER' ? 'PICKER' : null
    if (!role) {
      return NextResponse.json({ error: 'role PICKER is required' }, { status: 400 })
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { id: true, businessId: true, business: { select: { ownerId: true } } },
    })
    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }
    const ownerId = request.business?.ownerId
    if (user.role !== 'LEC7_ADMIN' && ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await prisma.requestAssignment.findUnique({
      where: { requestId_role: { requestId, role: 'PICKER' } },
      include: { invite: true },
    })
    if (existing?.invite) {
      const origin = getAppOrigin(req)
      return NextResponse.json({
        assignment: { id: existing.id, requestId: existing.requestId, role: existing.role },
        invite: {
          label: existing.invite.label,
          url: `${origin}/pick/invite/${existing.invite.token}`,
        },
      })
    }

    const token = randomBytes(TOKEN_BYTES).toString('hex')
    const pickerInvite = await prisma.pickerInvite.create({
      data: {
        token,
        label: PICKER_LABEL,
        requestId,
        createdByUserId: user.id,
      },
    })
    const assignment = await prisma.requestAssignment.create({
      data: {
        requestId,
        role: 'PICKER',
        createdByUserId: user.id,
        inviteId: pickerInvite.id,
      },
    })

    const origin = getAppOrigin(req)
    return NextResponse.json({
      assignment: { id: assignment.id, requestId: assignment.requestId, role: assignment.role },
      invite: {
        label: PICKER_LABEL,
        url: `${origin}/pick/invite/${pickerInvite.token}`,
      },
    })
  } catch (error) {
    console.error('Assign performer error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
