import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      businessId: string
      title: string
      description: string
      clientName?: string
      clientEmail?: string
      clientPhone?: string
      source?: string
    }
    const { businessId, title, description, clientName, clientEmail, clientPhone, source = 'ai_chat' } = body

    if (!businessId || !title || !description) {
      return NextResponse.json({ error: 'Неверные параметры' }, { status: 400 })
    }

    const request = await prisma.request.create({
      data: {
        businessId,
        title,
        description,
        clientName,
        clientEmail,
        clientPhone,
        source,
        status: 'NEW',
      },
    })

    return NextResponse.json(request)
  } catch (error) {
    console.error('Create request error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
