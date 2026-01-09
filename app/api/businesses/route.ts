import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/middleware'

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user || user.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as {
      name: string
      slug: string
      description?: string
    }
    const { name, slug, description } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'Имя и slug обязательны' }, { status: 400 })
    }

    // Проверяем уникальность slug
    const existing = await prisma.business.findUnique({
      where: { slug },
    })

    if (existing) {
      return NextResponse.json({ error: 'Бизнес с таким slug уже существует' }, { status: 400 })
    }

    const business = await prisma.business.create({
      data: {
        name,
        slug,
        description,
        ownerId: user.id,
      },
    })

    return NextResponse.json(business)
  } catch (error) {
    console.error('Create business error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
