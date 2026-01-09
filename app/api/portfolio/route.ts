import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
// import { uploadFile, getPortfolioKey } from '@/lib/s3' // Временно отключено

export async function POST(request: NextRequest) {
  // S3 временно отключен
  return NextResponse.json(
    { error: 'Portfolio upload temporarily disabled' },
    { status: 501 }
  )
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId обязателен' }, { status: 400 })
    }

    const portfolios = await prisma.portfolio.findMany({
      where: { businessId },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(portfolios)
  } catch (error) {
    console.error('Get portfolios error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
