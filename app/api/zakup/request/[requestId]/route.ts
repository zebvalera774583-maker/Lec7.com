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

export async function GET(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    if (!verifyZakupToken(request)) {
      return NextResponse.json({ error: 'Требуется авторизация zakup' }, { status: 401 })
    }

    if (!ZAKUP_BUSINESS_ID) {
      return NextResponse.json({ error: 'ZAKUP_BUSINESS_ID не настроен' }, { status: 500 })
    }

    const requestId = params.requestId
    if (!requestId) {
      return NextResponse.json({ error: 'requestId required' }, { status: 400 })
    }

    const reqRecord = await prisma.request.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        number: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
        businessId: true,
      },
    })

    if (!reqRecord) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (reqRecord.businessId !== ZAKUP_BUSINESS_ID) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const link = await prisma.maxRequestLink.findFirst({
      where: { requestId },
      select: { itemsJson: true },
    })

    return NextResponse.json({
      id: reqRecord.id,
      number: reqRecord.number,
      title: reqRecord.title,
      description: reqRecord.description,
      status: reqRecord.status,
      createdAt: reqRecord.createdAt.toISOString(),
      itemsJson: link?.itemsJson ?? null,
    })
  } catch (error) {
    console.error('Zakup request detail error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
