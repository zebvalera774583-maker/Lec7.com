import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/middleware'

/**
 * GET /api/office/businesses/[id]/portfolio-items
 * Получение списка кейсов портфолио бизнеса с вложенными фото
 */
export async function GET(request: NextRequest) {
  try {
    // Проверка авторизации
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Получаем businessId из URL
    const url = new URL(request.url)
    const businessId = url.pathname.split('/').slice(-2, -1)[0]

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }

    // Проверяем, что бизнес существует и принадлежит пользователю
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Резидент может просматривать только свой бизнес (или LEC7_ADMIN)
    if (user.role !== 'LEC7_ADMIN' && business.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Получаем список кейсов с фото, отсортированный по sortOrder
    const items = await prisma.businessPortfolioItem.findMany({
      where: { businessId },
      orderBy: { sortOrder: 'asc' },
      include: {
        photos: {
          orderBy: { sortOrder: 'asc' },
          take: 12, // Лимит 12 фото на кейс
          select: {
            id: true,
            url: true,
            sortOrder: true,
            createdAt: true,
          },
        },
      },
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('Get portfolio items error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * POST /api/office/businesses/[id]/portfolio-items
 * Создание нового кейса портфолио
 */
export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Получаем businessId из URL
    const url = new URL(request.url)
    const businessId = url.pathname.split('/').slice(-2, -1)[0]

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }

    // Проверяем, что бизнес существует и принадлежит пользователю
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Резидент может изменять только свой бизнес (или LEC7_ADMIN)
    if (user.role !== 'LEC7_ADMIN' && business.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Получаем body
    const body = await request.json().catch(() => ({}))
    const { comment } = body

    // Находим максимальный sortOrder и добавляем 1
    const maxSortOrder = await prisma.businessPortfolioItem.findFirst({
      where: { businessId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    const sortOrder = (maxSortOrder?.sortOrder ?? -1) + 1

    // Создаём новый кейс
    const item = await prisma.businessPortfolioItem.create({
      data: {
        businessId,
        comment: comment || null,
        sortOrder,
      },
      include: {
        photos: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error('Create portfolio item error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
