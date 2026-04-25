import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getNextRequestNumber } from '@/lib/request-number'
import { notifyAdminAboutInvestLead } from '@/lib/notify-admin'

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

    const createdRequest = await prisma.$transaction(async (tx) => {
      const number = await getNextRequestNumber(tx)
      return tx.request.create({
        data: {
          businessId,
          number,
          title,
          description,
          clientName,
          clientEmail,
          clientPhone,
          source,
          status: 'NEW',
        },
      })
    })

    await notifyAdminAboutInvestLead({
      name: createdRequest.clientName,
      phone: createdRequest.clientPhone,
      createdAt: createdRequest.createdAt,
    })

    return NextResponse.json(createdRequest)
  } catch (error) {
    console.error('Create request error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
