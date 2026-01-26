/**
 * Тестовый скрипт для проверки загрузки аватара в Google Cloud Storage
 * 
 * Запуск:
 *   docker-compose exec app node scripts/test-avatar-upload.mjs
 */

import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Импорт uploadPublicFile из lib/s3
let uploadPublicFile

try {
  const s3Module = await import('../lib/s3.js')
  uploadPublicFile = s3Module.uploadPublicFile
  console.log('✓ Используется импорт из lib/s3.js\n')
} catch (error) {
  console.error('✗ Не удалось импортировать lib/s3.js:', error.message)
  process.exit(1)
}

async function testAvatarUpload() {
  try {
    console.log('=== Тест загрузки аватара в Google Cloud Storage ===\n')

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
    const gcsKey = `avatars/${user.id}/manual-test.png`
    console.log(`Bucket: ${process.env.GCS_BUCKET || 'not set'}`)
    console.log(`Key: ${gcsKey}`)
    console.log('Загрузка в GCS...')
    
    const avatarUrl = await uploadPublicFile(imageBuffer, gcsKey, 'image/png')
    console.log(`✓ Файл загружен в GCS`)
    console.log(`Публичный URL: ${avatarUrl}\n`)

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
