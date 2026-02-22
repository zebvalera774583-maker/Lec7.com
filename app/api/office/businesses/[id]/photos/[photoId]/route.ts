import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess } from '@/lib/access'
import { deletePublicFileByUrl } from '@/lib/s3'

/**
 * DELETE /api/office/businesses/[id]/photos/[photoId]
 * Удаление фото портфолио бизнеса
 */
export const DELETE = withBusinessAccess(async (req, user) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.length - 3] // /api/office/businesses/[id]/photos/[photoId]
    const photoId = pathParts[pathParts.length - 1]

    if (!businessId || !photoId) {
      return NextResponse.json({ error: 'Business ID and Photo ID are required' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
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
})
