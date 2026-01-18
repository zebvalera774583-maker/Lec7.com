import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/middleware'
import { uploadPublicFile } from '@/lib/s3'

/**
 * POST /api/office/businesses/[id]/profile/avatar
 * Загрузка аватара бизнеса в S3
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Проверка авторизации
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const businessId = params.id

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }

    // Проверяем, что бизнес существует и принадлежит пользователю
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Резидент может изменять только свой бизнес (или LEC7_ADMIN)
    if (user.role !== 'LEC7_ADMIN' && business.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Получаем multipart/form-data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Проверка типа файла (только изображения)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Конвертируем File в Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Определяем расширение файла
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()

    // Формируем путь для S3: business-avatars/{businessId}/{timestamp}.{ext}
    const s3Key = `business-avatars/${businessId}/${timestamp}.${fileExtension}`

    // Загружаем файл в S3
    const avatarUrl = await uploadPublicFile(buffer, s3Key, file.type)

    // Сохраняем avatarUrl в BusinessProfile через upsert
    await prisma.businessProfile.upsert({
      where: { businessId },
      create: {
        businessId,
        avatarUrl,
        statsCases: 40,
        statsProjects: 2578,
        statsCities: 4,
        cities: [],
        services: [],
      },
      update: {
        avatarUrl,
      },
    })

    return NextResponse.json({ avatarUrl })
  } catch (error) {
    console.error('Business avatar upload error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
