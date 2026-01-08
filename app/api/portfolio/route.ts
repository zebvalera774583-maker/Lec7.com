import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadFile, getPortfolioKey } from '@/lib/s3'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const businessId = formData.get('businessId') as string
    const title = formData.get('title') as string
    const description = formData.get('description') as string | null
    const file = formData.get('file') as File
    const order = parseInt(formData.get('order') as string) || 0

    if (!businessId || !title || !file) {
      return NextResponse.json({ error: 'Неверные параметры' }, { status: 400 })
    }

    // Загружаем файл в S3
    const buffer = Buffer.from(await file.arrayBuffer())
    const key = getPortfolioKey(businessId, file.name)
    const imageUrl = await uploadFile(key, buffer, file.type)

    // Создаём запись в БД
    const portfolio = await prisma.portfolio.create({
      data: {
        businessId,
        title,
        description,
        imageUrl,
        order,
      },
    })

    return NextResponse.json(portfolio)
  } catch (error) {
    console.error('Create portfolio error:', error)
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
