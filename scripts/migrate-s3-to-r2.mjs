#!/usr/bin/env node
/**
 * Скрипт миграции файлов из Timeweb S3 в Cloudflare R2
 * 
 * Использование:
 * 1. Установите переменные окружения для Timeweb S3 и R2
 * 2. Запустите: node scripts/migrate-s3-to-r2.mjs
 * 
 * Переменные окружения:
 * - S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME (источник)
 * - R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (назначение)
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'stream'

// Клиент для Timeweb S3 (источник)
const sourceClient = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'ru-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
})

// Клиент для Cloudflare R2 (назначение)
const destClient = new S3Client({
  endpoint: process.env.R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: false,
})

const sourceBucket = process.env.S3_BUCKET_NAME
const destBucket = process.env.R2_BUCKET

if (!sourceBucket || !destBucket) {
  console.error('❌ Ошибка: S3_BUCKET_NAME и R2_BUCKET должны быть установлены')
  process.exit(1)
}

/**
 * Преобразует stream в Buffer
 */
async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

/**
 * Копирует один файл из источника в назначение
 */
async function copyFile(key) {
  try {
    // Получаем файл из источника
    const getCommand = new GetObjectCommand({
      Bucket: sourceBucket,
      Key: key,
    })
    
    const sourceObject = await sourceClient.send(getCommand)
    const buffer = await streamToBuffer(sourceObject.Body)
    
    // Загружаем в R2
    const putCommand = new PutObjectCommand({
      Bucket: destBucket,
      Key: key,
      Body: buffer,
      ContentType: sourceObject.ContentType || 'application/octet-stream',
    })
    
    await destClient.send(putCommand)
    return true
  } catch (error) {
    console.error(`❌ Ошибка при копировании ${key}:`, error.message)
    return false
  }
}

/**
 * Основная функция миграции
 */
async function migrate() {
  console.log('🚀 Начало миграции S3 → R2')
  console.log(`📦 Источник: ${sourceBucket} (Timeweb S3)`)
  console.log(`📦 Назначение: ${destBucket} (Cloudflare R2)`)
  console.log('')

  let continuationToken = undefined
  let totalFiles = 0
  let copiedFiles = 0
  let failedFiles = 0

  do {
    try {
      // Получаем список файлов (по 1000 за раз)
      const listCommand = new ListObjectsV2Command({
        Bucket: sourceBucket,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })

      const response = await sourceClient.send(listCommand)
      const objects = response.Contents || []

      console.log(`📋 Найдено ${objects.length} файлов в этой партии`)

      // Копируем каждый файл
      for (const obj of objects) {
        if (!obj.Key) continue
        
        totalFiles++
        process.stdout.write(`\r⏳ Копирование: ${obj.Key} (${totalFiles} файлов, ${copiedFiles} успешно, ${failedFiles} ошибок)`)

        const success = await copyFile(obj.Key)
        if (success) {
          copiedFiles++
        } else {
          failedFiles++
        }

        // Небольшая задержка, чтобы не перегружать API
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      continuationToken = response.NextContinuationToken
    } catch (error) {
      console.error('\n❌ Ошибка при получении списка файлов:', error.message)
      break
    }
  } while (continuationToken)

  console.log('\n')
  console.log('✅ Миграция завершена!')
  console.log(`📊 Статистика:`)
  console.log(`   Всего файлов: ${totalFiles}`)
  console.log(`   Успешно скопировано: ${copiedFiles}`)
  console.log(`   Ошибок: ${failedFiles}`)
  
  if (failedFiles > 0) {
    console.log('\n⚠️  Некоторые файлы не были скопированы. Проверьте логи выше.')
  }
}

// Запуск
migrate().catch(error => {
  console.error('❌ Критическая ошибка:', error)
  process.exit(1)
})
