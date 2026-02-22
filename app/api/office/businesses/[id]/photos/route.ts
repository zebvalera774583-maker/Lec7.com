import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess } from '@/lib/access'
import { uploadPublicFile } from '@/lib/s3'

/**
 * POST /api/office/businesses/[id]/photos
 * Загрузка фото портфолио бизнеса в S3
 */
export const POST = withBusinessAccess(async (req, user) => {
  try {
    const url = new URL(req.url)
    const businessId = url.pathname.split('/').slice(-2, -1)[0] // /api/office/businesses/[id]/photos

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Проверяем лимит фото (максимум 12)
    const existingPhotosCount = await prisma.businessPhoto.count({
      where: { businessId },
    })

    if (existingPhotosCount >= 12) {
      return NextResponse.json({ error: 'Maximum 12 photos allowed' }, { status: 400 })
    }

    // Получаем multipart/form-data
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Проверка типа файла (только изображения)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Проверка размера файла (максимум 20MB)
    const maxSize = 20 * 1024 * 1024 // 20MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Файл слишком большой. Максимум 20 МБ.' }, { status: 400 })
    }

    // Конвертируем File в Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Определяем расширение файла
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()

    // Формируем путь для S3: business-photos/{businessId}/{timestamp}.{ext}
    const s3Key = `business-photos/${businessId}/${timestamp}.${fileExtension}`

    // Загружаем файл в S3
    const photoUrl = await uploadPublicFile(buffer, s3Key, file.type)

    // Находим максимальный sortOrder и добавляем 1
    const maxSortOrder = await prisma.businessPhoto.findFirst({
      where: { businessId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    const sortOrder = (maxSortOrder?.sortOrder ?? -1) + 1

    // Сохраняем запись BusinessPhoto
    const photo = await prisma.businessPhoto.create({
      data: {
        businessId,
        url: photoUrl,
        sortOrder,
      },
    })

    return NextResponse.json({
      id: photo.id,
      url: photo.url,
      sortOrder: photo.sortOrder,
    })
  } catch (error) {
    console.error('Business photo upload error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

/**
 * GET /api/office/businesses/[id]/photos
 * Получение списка фото портфолио бизнеса
 */
export const GET = withBusinessAccess(async (req, user) => {
  try {
    const url = new URL(req.url)
    const businessId = url.pathname.split('/').slice(-2, -1)[0]

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Получаем список фото, отсортированный по sortOrder
    const photos = await prisma.businessPhoto.findMany({
      where: { businessId },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        url: true,
        sortOrder: true,
        createdAt: true,
      },
    })

    return NextResponse.json(photos)
  } catch (error) {
    console.error('Get business photos error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
