import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SECRET_HEADER = 'x-telegram-bot-api-secret-token'

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret) {
    const incoming = req.headers.get(SECRET_HEADER)
    if (incoming !== secret) {
      console.warn('Telegram webhook: secret mismatch')
      return NextResponse.json({ ok: false }, { status: 401 })
    }
  }

  let body: { message?: { text?: string; chat?: { id?: number } } }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const text = body?.message?.text?.trim()
  const chatId = body?.message?.chat?.id
  if (!text || chatId == null) {
    return NextResponse.json({ ok: true })
  }

  const match = /^\/start\s+(.+)$/.exec(text)
  const token = match?.[1]?.trim()
  if (!token) {
    return NextResponse.json({ ok: true })
  }

  try {
    const row = await prisma.telegramConnectToken.findUnique({
      where: { token },
      select: { id: true, businessId: true, expiresAt: true, usedAt: true },
    })

    if (!row || row.usedAt || new Date() > row.expiresAt) {
      return NextResponse.json({ ok: true })
    }

    const chatIdStr = String(chatId)
    const now = new Date()

    await prisma.$transaction([
      prisma.business.updateMany({
        where: { telegramChatId: chatIdStr, id: { not: row.businessId } },
        data: { telegramChatId: null, telegramConnectedAt: null },
      }),
      prisma.business.update({
        where: { id: row.businessId },
        data: { telegramChatId: chatIdStr, telegramConnectedAt: now },
      }),
      prisma.telegramConnectToken.update({
        where: { id: row.id },
        data: { usedAt: now },
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}
