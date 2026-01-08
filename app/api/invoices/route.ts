import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { businessId, requestId, clientName, clientEmail, clientPhone, amount, currency = 'RUB', dueDate } = await request.json()

    if (!businessId || !clientName || !amount) {
      return NextResponse.json({ error: 'Неверные параметры' }, { status: 400 })
    }

    // Генерируем номер счёта
    const count = await prisma.invoice.count({
      where: { businessId },
    })
    const number = `INV-${Date.now()}-${count + 1}`

    const invoice = await prisma.invoice.create({
      data: {
        businessId,
        requestId,
        number,
        clientName,
        clientEmail,
        clientPhone,
        amount,
        currency,
        status: 'DRAFT',
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    })

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Create invoice error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId обязателен' }, { status: 400 })
    }

    const invoices = await prisma.invoice.findMany({
      where: { businessId },
      include: {
        request: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(invoices)
  } catch (error) {
    console.error('Get invoices error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
