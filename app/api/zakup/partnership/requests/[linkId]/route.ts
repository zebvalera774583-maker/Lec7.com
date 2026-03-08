import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
const ZAKUP_BUSINESS_ID = process.env.ZAKUP_BUSINESS_ID ?? ''

function verifyZakupToken(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return false
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { zakup?: boolean }
    return decoded?.zakup === true
  } catch {
    return false
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { linkId: string } }
) {
  try {
    if (!verifyZakupToken(request)) {
      return NextResponse.json({ error: 'Требуется авторизация zakup' }, { status: 401 })
    }

    if (!ZAKUP_BUSINESS_ID) {
      return NextResponse.json({ error: 'ZAKUP_BUSINESS_ID не настроен' }, { status: 500 })
    }

    const linkId = params.linkId
    if (!linkId) {
      return NextResponse.json({ error: 'linkId required' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body?.action

    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json({ error: 'action must be "accept" or "decline"' }, { status: 400 })
    }

    const assignment = await prisma.priceAssignment.findUnique({
      where: { id: linkId },
      include: {
        priceList: { select: { businessId: true } },
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (assignment.counterpartyBusinessId !== ZAKUP_BUSINESS_ID) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (assignment.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request is not pending' }, { status: 409 })
    }

    const newStatus = action === 'accept' ? 'ACTIVE' : 'DECLINED'
    await prisma.priceAssignment.update({
      where: { id: linkId },
      data: {
        status: newStatus,
        respondedAt: new Date(),
      },
    })

    if (action === 'accept') {
      const { ensureActiveCounterparty } = await import('@/lib/activeCounterparty')
      await ensureActiveCounterparty(assignment.priceList.businessId, assignment.counterpartyBusinessId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Zakup partnership request error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
