import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/middleware'
import { uploadPublicFile, deletePublicFileByUrl } from '@/lib/s3'

/**
 * POST /api/office/businesses/[id]/portfolio-items/[itemId]/photos
 * Загрузка фото в кейс портфолио (поддержка multiple файлов)
 */
export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Получаем businessId и itemId из URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.length - 4] // /api/office/businesses/[id]/portfolio-items/[itemId]/photos
    const itemId = pathParts[pathParts.length - 2]

    if (!businessId || !itemId) {
      return NextResponse.json({ error: 'Business ID and Item ID are required' }, { status: 400 })
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

    // Проверяем, что кейс существует и принадлежит бизнесу
    const item = await prisma.businessPortfolioItem.findUnique({
      where: { id: itemId },
      select: { id: true, businessId: true },
    })

    if (!item) {
      return NextResponse.json({ error: 'Portfolio item not found' }, { status: 404 })
    }

    if (item.businessId !== businessId) {
      return NextResponse.json({ error: 'Portfolio item does not belong to this business' }, { status: 403 })
    }

    // Проверяем лимит фото (максимум 12 на кейс)
    const existingPhotosCount = await prisma.businessPortfolioPhoto.count({
      where: { itemId },
    })

    // Получаем multipart/form-data
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Files are required' }, { status: 400 })
    }

    // Проверяем, что после добавления не превысим лимит
    if (existingPhotosCount + files.length > 12) {
      return NextResponse.json(
        { error: `Максимум 12 фото на кейс. Уже загружено: ${existingPhotosCount}` },
        { status: 400 }
      )
    }

    // Проверка типов и размеров файлов
    const maxSize = 20 * 1024 * 1024 // 20MB
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Все файлы должны быть изображениями' }, { status: 400 })
      }
      if (file.size > maxSize) {
        return NextResponse.json({ error: 'Файл слишком большой. Максимум 20 МБ.' }, { status: 400 })
      }
    }

    // Находим максимальный sortOrder
    const maxSortOrder = await prisma.businessPortfolioPhoto.findFirst({
      where: { itemId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    let currentSortOrder = (maxSortOrder?.sortOrder ?? -1) + 1

    // Загружаем все файлы
    const uploadedPhotos = []

    for (const file of files) {
      // Конвертируем File в Buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Определяем расширение файла
      const fileExtension = file.name.split('.').pop() || 'jpg'
      const timestamp = Date.now() + Math.random() // Добавляем случайность для уникальности

      // Формируем путь для S3: business-portfolio/{businessId}/{itemId}/{timestamp}.{ext}
      const s3Key = `business-portfolio/${businessId}/${itemId}/${timestamp}.${fileExtension}`

      // Загружаем файл в S3
      const photoUrl = await uploadPublicFile(buffer, s3Key, file.type)

      // Сохраняем запись
      const photo = await prisma.businessPortfolioPhoto.create({
        data: {
          itemId,
          url: photoUrl,
          sortOrder: currentSortOrder++,
        },
      })

      uploadedPhotos.push({
        id: photo.id,
        url: photo.url,
        sortOrder: photo.sortOrder,
      })
    }

    return NextResponse.json({ photos: uploadedPhotos })
  } catch (error) {
    console.error('Portfolio item photo upload error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
