import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'
import { randomBytes } from 'crypto'

const withOfficeAuth = (handler: (req: NextRequest, user: { id: string; role: string }) => Promise<NextResponse>) =>
  requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

const TOKEN_BYTES = 24
const EXPIRES_MINUTES = 15

export const POST = withOfficeAuth(async (req: NextRequest, user: { id: string; role: string }) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (user.role !== 'LEC7_ADMIN' && business.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const connectToken = randomBytes(TOKEN_BYTES).toString('hex')
    const expiresAt = new Date(Date.now() + EXPIRES_MINUTES * 60 * 1000)

    await prisma.telegramConnectToken.create({
      data: {
        businessId,
        token: connectToken,
        expiresAt,
      },
    })

    const botUsername = process.env.TELEGRAM_BOT_USERNAME?.trim() || ''
    const botStartUrl = botUsername
      ? `https://t.me/${botUsername}?start=${connectToken}`
      : ''

    return NextResponse.json({
      connectToken,
      botStartUrl,
    })
  } catch (error) {
    console.error('Telegram connect error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
