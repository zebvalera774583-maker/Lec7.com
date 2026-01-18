import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/middleware'
import { uploadPublicFile } from '@/lib/s3'

/**
 * POST /api/profile/avatar
 * Загрузка аватара резидента (текущего пользователя)
 */
export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Формируем путь для S3: avatars/{userId}/{timestamp}.{ext}
    const s3Key = `avatars/${user.id}/${timestamp}.${fileExtension}`

    // Загружаем файл в S3
    const avatarUrl = await uploadPublicFile(buffer, s3Key, file.type)

    // Сохраняем URL в БД
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl },
    })

    return NextResponse.json({ avatarUrl })
  } catch (error) {
    console.error('Avatar upload error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
