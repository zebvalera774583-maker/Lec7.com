import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateSlug } from '@/lib/slug'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const city = searchParams.get('city') || ''
    const category = searchParams.get('category') || ''

    const where: any = {}

    // Поиск по name, city, category через OR
    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          city: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          category: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ]
    }

    // Фильтры city и category через AND
    if (city) {
      where.city = city
    }

    if (category) {
      where.category = category
    }

    const businesses = await prisma.business.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        slug: true,
        name: true,
        city: true,
        category: true,
        createdAt: true,
      },
    })

    return NextResponse.json(businesses)
  } catch (error) {
    console.error('Error fetching businesses:', error)
    return NextResponse.json(
      { error: 'Ошибка получения списка бизнесов' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, city, category } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Поле name обязательно' },
        { status: 400 }
      )
    }

    // Генерируем уникальный slug
    let baseSlug = generateSlug(name)
    let slug = baseSlug
    let counter = 1

    // Проверяем уникальность slug
    while (await prisma.business.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Временно: создаём или получаем тестового пользователя для бизнесов без авторизации
    // В продакшене ownerId должен приходить из сессии/токена
    let testUser = await prisma.user.findFirst({
      where: { email: 'test@lec7.com' },
    })

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'test@lec7.com',
          password: 'temp', // В продакшене не используется без авторизации
          name: 'Test User',
          role: 'BUSINESS_OWNER',
        },
      })
    }

    const business = await prisma.business.create({
      data: {
        name,
        slug,
        city: city || null,
        category: category || null,
        ownerId: testUser.id,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        city: true,
        category: true,
        createdAt: true,
      },
    })

    return NextResponse.json(business, { status: 201 })
  } catch (error) {
    console.error('Error creating business:', error)
    return NextResponse.json(
      { error: 'Ошибка создания бизнеса' },
      { status: 500 }
    )
  }
}
