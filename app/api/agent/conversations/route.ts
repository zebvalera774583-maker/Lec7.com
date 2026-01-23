import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/types'

/**
 * POST /api/agent/conversations
 * Создание нового чата агента
 */
export async function POST(request: NextRequest) {
  try {
    // Проверка аутентификации
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Парсинг body
    const body = await request.json().catch(() => ({}))
    const scope = body.scope ?? 'PLATFORM'
    const mode = body.mode ?? 'CREATOR'
    const businessId = body.businessId ?? null
    const title = body.title ?? null

    // Валидация scope
    const allowedScopes = new Set(['PLATFORM', 'BUSINESS', 'PUBLIC'])
    if (!allowedScopes.has(scope)) {
      return NextResponse.json({ error: 'Invalid scope' }, { status: 400 })
    }

    // Валидация mode
    const allowedModes = new Set(['CREATOR', 'RESIDENT', 'CLIENT'])
    if (!allowedModes.has(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    }

    // Для BUSINESS scope требуется businessId
    if (scope === 'BUSINESS' && !businessId) {
      return NextResponse.json(
        { error: 'businessId is required for BUSINESS scope' },
        { status: 400 }
      )
    }

    // Проверка доступа к бизнесу (если scope=BUSINESS)
    if (scope === 'BUSINESS' && businessId) {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { ownerId: true },
      })

      if (!business) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 })
      }

      // Проверяем, что пользователь является владельцем бизнеса или админом
      if (business.ownerId !== user.id && user.role !== 'LEC7_ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Проверка прав для PLATFORM scope (только для админов)
    if (scope === 'PLATFORM' && user.role !== 'LEC7_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Создание чата
    const conversation = await prisma.agentConversation.create({
      data: {
        userId: user.id,
        scope: scope as 'PLATFORM' | 'BUSINESS' | 'PUBLIC',
        mode: mode as 'CREATOR' | 'RESIDENT' | 'CLIENT',
        businessId: scope === 'BUSINESS' ? businessId : null,
        title,
      },
      select: {
        id: true,
        title: true,
        scope: true,
        mode: true,
        businessId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ conversation })
  } catch (error) {
    console.error('Error creating agent conversation:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/**
 * GET /api/agent/conversations
 * Получение списка чатов агента для текущего пользователя
 */
export async function GET(request: NextRequest) {
  try {
    // Проверка аутентификации
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Парсинг query параметров
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope') as 'PLATFORM' | 'BUSINESS' | 'PUBLIC' | null
    const businessId = searchParams.get('businessId') || null

    // Построение where условия
    const where: any = {
      userId: user.id,
    }

    // Фильтр по scope
    if (scope) {
      where.scope = scope
    }

    // Фильтр по businessId
    if (businessId) {
      where.businessId = businessId
    }

    // Для обычных пользователей показываем только их бизнесы
    if (user.role !== 'LEC7_ADMIN') {
      // Если scope=PLATFORM, не показываем (только для админов)
      if (scope === 'PLATFORM') {
        return NextResponse.json({ conversations: [] })
      }

      // Для BUSINESS scope проверяем доступ к бизнесу
      if (scope === 'BUSINESS' && businessId) {
        const business = await prisma.business.findUnique({
          where: { id: businessId },
          select: { ownerId: true },
        })

        if (!business || business.ownerId !== user.id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
    }

    // Получение списка чатов
    const conversations = await prisma.agentConversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        scope: true,
        mode: true,
        businessId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            messages: true,
          },
        },
      },
      take: 50, // Ограничение на количество
    })

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Error fetching agent conversations:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
