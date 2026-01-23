import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/agent/conversations/[id]
 * Получение деталей конкретного чата
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Проверка аутентификации
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversationId = params.id

    // Получение чата с последними сообщениями
    const conversation = await prisma.agentConversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        title: true,
        scope: true,
        mode: true,
        businessId: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            messages: true,
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Проверка доступа
    if (conversation.userId !== user.id && user.role !== 'LEC7_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Получение последних сообщений (опционально, для предпросмотра)
    const recentMessages = await prisma.agentMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      conversation: {
        ...conversation,
        recentMessages: recentMessages.reverse(), // Возвращаем в хронологическом порядке
      },
    })
  } catch (error) {
    console.error('Error fetching conversation:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/agent/conversations/[id]
 * Обновление чата (например, переименование)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Проверка аутентификации
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversationId = params.id

    // Проверка существования чата и доступа
    const conversation = await prisma.agentConversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        userId: true,
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Проверка доступа
    if (conversation.userId !== user.id && user.role !== 'LEC7_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Парсинг body
    const body = await request.json().catch(() => ({}))
    const title = body.title

    // Обновление чата
    const updated = await prisma.agentConversation.update({
      where: { id: conversationId },
      data: {
        ...(title !== undefined && { title: title || null }),
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

    return NextResponse.json({ conversation: updated })
  } catch (error) {
    console.error('Error updating conversation:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/agent/conversations/[id]
 * Удаление чата
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Проверка аутентификации
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversationId = params.id

    // Проверка существования чата и доступа
    const conversation = await prisma.agentConversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        userId: true,
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Проверка доступа
    if (conversation.userId !== user.id && user.role !== 'LEC7_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Удаление чата (сообщения удалятся каскадно)
    await prisma.agentConversation.delete({
      where: { id: conversationId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting conversation:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
