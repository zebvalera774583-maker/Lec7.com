import { NextRequest, NextResponse } from 'next/server'
import { createAIChatResponse } from '@/lib/openai'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      businessId: string
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
    }
    const { businessId, messages } = body

    if (!businessId || !messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Неверные параметры' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
    })

    if (!business) {
      return NextResponse.json({ error: 'Бизнес не найден' }, { status: 404 })
    }

    const result = await createAIChatResponse(messages, {
      businessName: business.name,
      businessDescription: business.description || undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
