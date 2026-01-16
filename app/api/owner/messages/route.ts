import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

// Доступ только для владельца Lec7 (LEC7_ADMIN)
const withOwnerAuth = (handler: any) =>
  requireRole(['LEC7_ADMIN'], handler)

export const GET = withOwnerAuth(async (req: any, user: any) => {
  try {
    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      )
    }

    const conversation = await prisma.ownerConversation.findFirst({
      where: { id: conversationId, userId: user.id },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }

    const messages = await prisma.ownerMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error('Owner messages GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

export const POST = withOwnerAuth(async (req: NextRequest, user: any) => {
  try {
    const body = (await req.json()) as {
      conversationId: string
      content: string
    }

    if (!body.conversationId || !body.content?.trim()) {
      return NextResponse.json(
        { error: 'conversationId and content are required' },
        { status: 400 }
      )
    }

    const conversation = await prisma.ownerConversation.findFirst({
      where: { id: body.conversationId, userId: user.id },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }

    const message = await prisma.ownerMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: body.content.trim(),
      },
    })

    // AuditLog
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'OWNER_MESSAGE_CREATED',
        metadata: {
          conversationId: conversation.id,
          messageId: message.id,
        },
      },
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Owner messages POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

