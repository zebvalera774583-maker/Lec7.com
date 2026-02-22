import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess } from '@/lib/access'

function maskChatId(chatId: string): string {
  if (chatId.length <= 6) return '***'
  return chatId.slice(0, 3) + '***' + chatId.slice(-3)
}

export const GET = withBusinessAccess(async (req, user) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const recipients = await prisma.businessTelegramRecipient.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, chatId: true, label: true, isActive: true, createdAt: true },
    })

    const list = recipients.map((r) => ({
      id: r.id,
      chatIdMasked: maskChatId(r.chatId),
      label: r.label,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
    }))

    return NextResponse.json(list)
  } catch (error) {
    console.error('Telegram recipients GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
