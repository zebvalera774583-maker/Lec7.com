import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

// Доступ только для владельца Lec7 (LEC7_ADMIN)
const withOwnerAuth = (handler: any) => requireRole(['LEC7_ADMIN'], handler)

export const GET = withOwnerAuth(async (_req: any, user: any) => {
  try {
    const conversations = await prisma.ownerConversation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(conversations)
  } catch (error) {
    console.error('Owner conversations GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

export const POST = withOwnerAuth(async (req: NextRequest, user: any) => {
  try {
    const body = (await req.json()) as {
      title?: string
    }

    const conversation = await prisma.ownerConversation.create({
      data: {
        userId: user.id,
        title: body.title || null,
      },
    })

    // AuditLog
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'OWNER_CONVERSATION_CREATED',
        metadata: {
          conversationId: conversation.id,
          title: conversation.title,
        },
      },
    })

    return NextResponse.json(conversation, { status: 201 })
  } catch (error) {
    console.error('Owner conversations POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

