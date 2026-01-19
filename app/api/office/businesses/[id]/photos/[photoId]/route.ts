import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/middleware'
import { deletePublicFileByUrl } from '@/lib/s3'

/**
 * DELETE /api/office/businesses/[id]/photos/[photoId]
 * Удаление фото портфолио бизнеса
 */
export async function DELETE(request: NextRequest) {
  try {
    // Проверка авторизации
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Получаем businessId и photoId из URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.length - 3] // /api/office/businesses/[id]/photos/[photoId]
    const photoId = pathParts[pathParts.length - 1]

    if (!businessId || !photoId) {
      return NextResponse.json({ error: 'Business ID and Photo ID are required' }, { status: 400 })
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

    // Находим фото
    const photo = await prisma.businessPhoto.findUnique({
      where: { id: photoId },
      select: { id: true, url: true, businessId: true },
    })

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    // Проверяем, что фото принадлежит этому бизнесу
    if (photo.businessId !== businessId) {
      return NextResponse.json({ error: 'Photo does not belong to this business' }, { status: 403 })
    }

    // Удаляем файл из S3
    try {
      await deletePublicFileByUrl(photo.url)
    } catch (error) {
      // Ошибки удаления из S3 не пробрасываем - только логируем
      console.warn('Failed to delete photo file from S3:', error)
    }

    // Удаляем запись из БД
    await prisma.businessPhoto.delete({
      where: { id: photoId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete business photo error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
