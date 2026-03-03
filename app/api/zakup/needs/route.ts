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

export async function GET(request: NextRequest) {
  try {
    if (!verifyZakupToken(request)) {
      return NextResponse.json({ error: 'Требуется авторизация zakup' }, { status: 401 })
    }

    if (!ZAKUP_BUSINESS_ID) {
      return NextResponse.json({ error: 'ZAKUP_BUSINESS_ID не настроен' }, { status: 500 })
    }

    const businessId = ZAKUP_BUSINESS_ID

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Входящие заявки (PENDING, где текущий бизнес - получатель)
    const incomingAssignments = await prisma.priceAssignment.findMany({
      where: {
        counterpartyBusinessId: businessId,
        status: 'PENDING',
      },
      include: {
        priceList: {
          include: {
            business: {
              select: {
                id: true,
                legalName: true,
                name: true,
                slug: true,
                profile: { select: { residentNumber: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const incomingRequests = incomingAssignments.map((assignment) => {
      const fromBusiness = assignment.priceList.business
      return {
        linkId: assignment.id,
        fromBusinessId: fromBusiness.id,
        fromLegalName: fromBusiness.legalName,
        fromName: fromBusiness.name,
        fromSlug: fromBusiness.slug,
        fromResidentNumber: fromBusiness.profile?.residentNumber || null,
        createdAt: assignment.createdAt.toISOString(),
      }
    })

    // Заявки из MAX — без ARCHIVED
    const maxRequests = await prisma.request.findMany({
      where: {
        businessId,
        source: 'max_integration',
        status: { not: 'ARCHIVED' },
      },
      orderBy: { number: 'asc' },
      select: {
        id: true,
        number: true,
        title: true,
        description: true,
        createdAt: true,
        incomingRequest: { select: { department: true } },
      },
    })

    const DEPT_LABELS: Record<string, string> = {
      voikovo_kitchen: 'Войково кухня',
      voikovo_bar: 'Войково бар',
      navaginskaya_kitchen: 'Навагинская кухня',
      navaginskaya_bar: 'Навагинская бар',
      moremall_kitchen: 'МореМолл кухня',
      moremall_bar: 'МореМолл бар',
    }

    return NextResponse.json({
      businessId: business.id,
      businessName: business.name,
      incomingRequests,
      maxRequests: maxRequests.map((r) => ({
        requestId: r.id,
        number: r.number,
        title: r.title,
        description: r.description,
        createdAt: r.createdAt.toISOString(),
        department: r.incomingRequest?.department
          ? DEPT_LABELS[r.incomingRequest.department] ?? r.incomingRequest.department
          : null,
      })),
    })
  } catch (error) {
    console.error('Zakup needs error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
