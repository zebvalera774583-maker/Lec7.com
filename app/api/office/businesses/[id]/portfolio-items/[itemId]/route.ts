import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/middleware'
import { deletePublicFileByUrl } from '@/lib/s3'

/**
 * PATCH /api/office/businesses/[id]/portfolio-items/[itemId]
 * Обновление кейса портфолио
 */
export async function PATCH(request: NextRequest) {
  try {
    // Проверка авторизации
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Получаем businessId и itemId из URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.length - 3] // /api/office/businesses/[id]/portfolio-items/[itemId]
    const itemId = pathParts[pathParts.length - 1]

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
      select: { id: true, businessId: true, coverUrl: true },
    })

    if (!item) {
      return NextResponse.json({ error: 'Portfolio item not found' }, { status: 404 })
    }

    if (item.businessId !== businessId) {
      return NextResponse.json({ error: 'Portfolio item does not belong to this business' }, { status: 403 })
    }

    // Получаем body
    const body = await request.json().catch(() => ({}))
    const { comment, coverPhotoId } = body

    // Если указан coverPhotoId, проверяем что фото существует и принадлежит кейсу
    let coverUrl = item.coverUrl
    if (coverPhotoId !== undefined) {
      if (coverPhotoId === null) {
        coverUrl = null
      } else {
        const photo = await prisma.businessPortfolioPhoto.findUnique({
          where: { id: coverPhotoId },
          select: { id: true, url: true, itemId: true },
        })

        if (!photo || photo.itemId !== itemId) {
          return NextResponse.json({ error: 'Photo not found or does not belong to this item' }, { status: 404 })
        }

        coverUrl = photo.url
      }
    }

    // Обновляем кейс
    const updatedItem = await prisma.businessPortfolioItem.update({
      where: { id: itemId },
      data: {
        ...(comment !== undefined && { comment }),
        ...(coverPhotoId !== undefined && { coverUrl }),
      },
      include: {
        photos: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return NextResponse.json(updatedItem)
  } catch (error) {
    console.error('Update portfolio item error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * DELETE /api/office/businesses/[id]/portfolio-items/[itemId]
 * Удаление кейса портфолио и всех его фото
 */
export async function DELETE(request: NextRequest) {
  try {
    // Проверка авторизации
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Получаем businessId и itemId из URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.length - 3]
    const itemId = pathParts[pathParts.length - 1]

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
      include: {
        photos: {
          select: { id: true, url: true },
        },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Portfolio item not found' }, { status: 404 })
    }

    if (item.businessId !== businessId) {
      return NextResponse.json({ error: 'Portfolio item does not belong to this business' }, { status: 403 })
    }

    // Удаляем все фото из S3
    for (const photo of item.photos) {
      try {
        await deletePublicFileByUrl(photo.url)
      } catch (error) {
        console.warn('Failed to delete photo file from S3:', error)
      }
    }

    // Удаляем кейс (каскадно удалятся все фото)
    await prisma.businessPortfolioItem.delete({
      where: { id: itemId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete portfolio item error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
