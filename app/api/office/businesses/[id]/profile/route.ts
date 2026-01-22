import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'
import { isLatinOnly } from '@/lib/slug'

// Доступ для BUSINESS_OWNER и LEC7_ADMIN
const withOfficeAuth = (handler: any) => requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

export const GET = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const businessId = url.pathname.split('/').slice(-2, -1)[0] // /api/office/businesses/[id]/profile

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    // Проверяем, что бизнес существует и принадлежит пользователю (или LEC7_ADMIN)
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Резидент может видеть только свой бизнес
    if (user.role !== 'LEC7_ADMIN' && business.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Получаем или создаём профиль (upsert)
    const profile = await prisma.businessProfile.upsert({
      where: { businessId },
      create: {
        businessId,
        statsCases: 40,
        statsProjects: 2578,
        statsCities: 4,
        cities: [],
        services: [],
      },
      update: {},
      include: {
        business: {
          select: {
            portfolios: {
              select: { id: true },
            },
          },
        },
      },
    })

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Get business profile error:', error)
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

    // Проверяем, что бизнес существует и принадлежит пользователю
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Резидент может изменять только свой бизнес
    if (user.role !== 'LEC7_ADMIN' && business.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const {
      displayName,
      avatarUrl,
      phone,
      telegramUsername,
      statsCases,
      statsProjects,
      statsCities,
      cities,
      services,
      featuredServices,
    } = body

    // Валидация displayName: только латиница, цифры, пробелы, дефисы
    if (displayName !== undefined && displayName !== null && displayName !== '') {
      if (!isLatinOnly(displayName)) {
        return NextResponse.json(
          { error: 'INVALID_DISPLAY_NAME_LATIN_ONLY', message: 'Отображаемое имя должно содержать только латинские буквы, цифры, пробелы и дефисы' },
          { status: 400 }
        )
      }
    }

    // Валидация
    if (statsCases !== undefined && (typeof statsCases !== 'number' || statsCases < 0)) {
      return NextResponse.json({ error: 'Invalid statsCases' }, { status: 400 })
    }
    if (statsProjects !== undefined && (typeof statsProjects !== 'number' || statsProjects < 0)) {
      return NextResponse.json({ error: 'Invalid statsProjects' }, { status: 400 })
    }
    if (statsCities !== undefined && (typeof statsCities !== 'number' || statsCities < 0)) {
      return NextResponse.json({ error: 'Invalid statsCities' }, { status: 400 })
    }
    if (cities !== undefined && !Array.isArray(cities)) {
      return NextResponse.json({ error: 'Invalid cities' }, { status: 400 })
    }
    if (services !== undefined && !Array.isArray(services)) {
      return NextResponse.json({ error: 'Invalid services' }, { status: 400 })
    }
    if (featuredServices !== undefined && !Array.isArray(featuredServices)) {
      return NextResponse.json({ error: 'Invalid featuredServices' }, { status: 400 })
    }

    // Если передан featuredServices, используем его (максимум 4, без пустых)
    // Иначе используем старый services для обратной совместимости
    const servicesToSave =
      featuredServices !== undefined
        ? featuredServices.filter((s: string) => s && s.trim() !== '').slice(0, 4)
        : services !== undefined
          ? services
          : undefined

    // Обновляем или создаём профиль (upsert)
    const profile = await prisma.businessProfile.upsert({
      where: { businessId },
      create: {
        businessId,
        displayName: displayName || null,
        avatarUrl: avatarUrl || null,
        phone: phone || null,
        telegramUsername: telegramUsername || null,
        statsCases: statsCases ?? 40,
        statsProjects: statsProjects ?? 2578,
        statsCities: statsCities ?? 4,
        cities: cities || [],
        services: servicesToSave || [],
      },
      update: {
        displayName: displayName !== undefined ? displayName || null : undefined,
        avatarUrl: avatarUrl !== undefined ? avatarUrl || null : undefined,
        phone: phone !== undefined ? phone || null : undefined,
        telegramUsername: telegramUsername !== undefined ? telegramUsername || null : undefined,
        statsCases: statsCases !== undefined ? statsCases : undefined,
        statsProjects: statsProjects !== undefined ? statsProjects : undefined,
        statsCities: statsCities !== undefined ? statsCities : undefined,
        cities: cities !== undefined ? cities : undefined,
        services: servicesToSave !== undefined ? servicesToSave : undefined,
      },
    })

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Update business profile error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
