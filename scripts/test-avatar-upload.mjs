/**
 * Тестовый скрипт для проверки загрузки аватара в S3
 * 
 * Запуск:
 *   docker-compose exec app node scripts/test-avatar-upload.mjs
 */

import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Попытка импорта uploadPublicFile из lib/s3
// Если не работает, используем встроенную версию
let uploadPublicFile

try {
  const s3Module = await import('../lib/s3.js')
  uploadPublicFile = s3Module.uploadPublicFile
  console.log('✓ Используется импорт из lib/s3.js\n')
} catch (error) {
  // Fallback: встроенная версия функции
  console.log('⚠ Импорт из lib/s3.js не удался, используется встроенная версия\n')
  
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
  
  const s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'ru-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true,
  })

  uploadPublicFile = async (buffer, key, contentType) => {
    const bucketName = process.env.S3_BUCKET_NAME
    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set')
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
    })

    await s3Client.send(command)

    const publicUrl = process.env.S3_PUBLIC_URL
    if (!publicUrl) {
      throw new Error('S3_PUBLIC_URL environment variable is not set')
    }

    const baseUrl = publicUrl.replace(/\/$/, '')
    const fileKey = key.startsWith('/') ? key : `/${key}`
    return `${baseUrl}${fileKey}`
  }
}

async function testAvatarUpload() {
  try {
    console.log('=== Тест загрузки аватара в S3 ===\n')

    // a) Получаем первого пользователя из БД
    const user = await prisma.user.findFirst()
    
    if (!user) {
      throw new Error('Пользователи не найдены в БД')
    }

    console.log(`Найден пользователь: ${user.email} (ID: ${user.id})\n`)

    // b) Читаем файл public/test-avatar.png
    const testImagePath = path.join(process.cwd(), 'public', 'test-avatar.png')
    
    let imageBuffer
    try {
      imageBuffer = fs.readFileSync(testImagePath)
      console.log(`✓ Файл прочитан: ${testImagePath} (${imageBuffer.length} байт)\n`)
    } catch (error) {
      throw new Error(`Не удалось прочитать файл ${testImagePath}: ${error.message}`)
    }

    // c) Загружаем через uploadPublicFile
    const s3Key = `avatars/${user.id}/manual-test.png`
    console.log(`Путь в S3: ${s3Key}`)
    console.log('Загрузка в S3...')
    
    const avatarUrl = await uploadPublicFile(imageBuffer, s3Key, 'image/png')
    console.log(`✓ Файл загружен в S3\n`)

    // d) Сохраняем avatarUrl в user
    console.log('Сохранение avatarUrl в БД...')
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl },
    })
    console.log(`✓ avatarUrl сохранён в БД\n`)

    // e) Выводим публичный URL
    console.log('=== РЕЗУЛЬТАТ ===')
    console.log(`Публичный URL аватара: ${avatarUrl}\n`)

    // f) Выводим проверку из БД
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, avatarUrl: true },
    })
    console.log(`Проверка БД:`)
    console.log(`  Email: ${updatedUser?.email}`)
    console.log(`  AvatarUrl: ${updatedUser?.avatarUrl}`)

    console.log('\n✓ Тест успешно завершён!')

  } catch (error) {
    console.error('\n✗ Ошибка:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testAvatarUpload()
