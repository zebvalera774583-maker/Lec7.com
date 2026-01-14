import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

// Доступ только для владельца Lec7 (LEC7_ADMIN)
const withOwnerAuth = (handler: any) => requireRole(['LEC7_ADMIN'], handler)

export const GET = withOwnerAuth(async (req: any, user: any) => {
  try {
    const conversationId = req.params?.id as string | undefined

    if (!conversationId) {
      return NextResponse.json({ error: 'conversation id is required' }, { status: 400 })
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
    const url = new URL(req.url)
    const conversationId = url.pathname.split('/').slice(-2, -1)[0] // /api/owner/conversations/[id]/messages

    if (!conversationId) {
      return NextResponse.json({ error: 'conversation id is required' }, { status: 400 })
    }

    const body = (await req.json()) as {
      content: string
    }

    if (!body.content?.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const conversation = await prisma.ownerConversation.findFirst({
      where: { id: conversationId, userId: user.id },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }

    const content = body.content.trim()

    const userMessage = await prisma.ownerMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content,
      },
    })

    const assistantText =
      'Я в advisory-режиме. Опиши задачу: баг, фича или деплой. ' +
      'Я сформулирую: (1) диагноз, (2) шаги для Cursor, (3) шаги для Timeweb/SSH.'

    const assistantMessage = await prisma.ownerMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: assistantText,
      },
    })

    return NextResponse.json(
      {
        messages: [userMessage, assistantMessage],
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Owner messages POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

