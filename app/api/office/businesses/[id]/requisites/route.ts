import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

const withOfficeAuth = (handler: any) => requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

const REQUISITES_FIELDS = [
  'legalName',
  'address',
  'ogrn',
  'inn',
  'bankAccount',
  'bank',
  'bankCorrAccount',
  'bik',
  'requisitesPhone',
  'requisitesEmail',
  'director',
] as const

export const GET = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const businessId = url.pathname.split('/').slice(-2, -1)[0]

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const accessBusiness = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true, ...Object.fromEntries(REQUISITES_FIELDS.map((f) => [f, true])) },
    })

    if (!accessBusiness) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (user.role !== 'LEC7_ADMIN' && accessBusiness.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const requisites = REQUISITES_FIELDS.reduce(
      (acc, key) => {
        acc[key] = (accessBusiness as any)[key] ?? null
        return acc
      },
      {} as Record<string, string | null>,
    )
    return NextResponse.json(requisites)
  } catch (error) {
    console.error('Get requisites error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

export const PUT = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const businessId = url.pathname.split('/').slice(-2, -1)[0]

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const accessBusiness = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    })

    if (!accessBusiness) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (user.role !== 'LEC7_ADMIN' && accessBusiness.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const data: Record<string, string | null> = {}

    for (const key of REQUISITES_FIELDS) {
      const v = body[key]
      if (v !== undefined) {
        data[key] = v === '' || v === null ? null : String(v).trim().slice(0, 500) || null
      }
    }

    await prisma.business.update({
      where: { id: businessId },
      data,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Update requisites error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
