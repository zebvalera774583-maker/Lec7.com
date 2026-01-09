import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      businessId: string
      title: string
      description: string
      clientName?: string
      clientEmail?: string
      clientPhone?: string
      source?: string
    }

    const {
      businessId,
      title,
      description,
      clientName,
      clientEmail,
      clientPhone,
      source = 'ai_chat',
    } = body

    if (!businessId || !title || !description) {
      return NextResponse.json({ error: 'Неверные параметры' }, { status: 400 })
    }

    const createdRequest = await prisma.request.create({
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

    return NextResponse.json(createdRequest)
  } catch (error) {
    console.error('Create request error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
