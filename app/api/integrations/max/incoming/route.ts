import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SECRET_HEADER = 'x-lec7-max-secret'

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.LEC7_MAX_SECRET
  if (expectedSecret) {
    const incoming = req.headers.get(SECRET_HEADER)
    if (incoming !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: { chatId?: unknown; userId?: unknown; text?: string; messageId?: unknown; ts?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const businessId = process.env.LEC7_MAX_BUSINESS_ID

  if (businessId) {
    try {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true },
      })
      if (business) {
        await prisma.request.create({
          data: {
            businessId,
            title: `Заявка из MAX: ${text.slice(0, 80) || 'Новое сообщение'}`,
            description: text || 'Сообщение из MAX',
            source: 'max_integration',
          },
        })
      }
    } catch (err) {
      console.error('MAX incoming: failed to create request', err)
    }
  }

  return NextResponse.json({ replyText: 'Спасибо, заявка принята' })
}
