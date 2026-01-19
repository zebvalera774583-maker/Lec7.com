import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/middleware'
import { deletePublicFileByUrl } from '@/lib/s3'

/**
 * DELETE /api/office/businesses/[id]/portfolio-items/[itemId]/photos/[photoId]
 * Удаление фото из кейса портфолио
 */
export async function DELETE(request: NextRequest) {
  try {
    // Проверка авторизации
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Получаем businessId, itemId и photoId из URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.length - 5] // /api/office/businesses/[id]/portfolio-items/[itemId]/photos/[photoId]
    const itemId = pathParts[pathParts.length - 3]
    const photoId = pathParts[pathParts.length - 1]

    if (!businessId || !itemId || !photoId) {
      return NextResponse.json({ error: 'Business ID, Item ID and Photo ID are required' }, { status: 400 })
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

    // Находим фото
    const photo = await prisma.businessPortfolioPhoto.findUnique({
      where: { id: photoId },
      select: { id: true, url: true, itemId: true },
    })

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    if (photo.itemId !== itemId) {
      return NextResponse.json({ error: 'Photo does not belong to this item' }, { status: 403 })
    }

    // Удаляем файл из S3
    try {
      await deletePublicFileByUrl(photo.url)
    } catch (error) {
      console.warn('Failed to delete photo file from S3:', error)
    }

    // Удаляем запись из БД
    await prisma.businessPortfolioPhoto.delete({
      where: { id: photoId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete portfolio item photo error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
