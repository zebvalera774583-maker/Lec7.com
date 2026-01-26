import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

/**
 * Определяем тип хранилища по переменным окружения
 * Если есть R2_ENDPOINT - используем Cloudflare R2
 * Иначе - Timeweb S3 (для обратной совместимости)
 */
const isR2 = !!process.env.R2_ENDPOINT

/**
 * Инициализация S3 клиента
 * - Cloudflare R2: forcePathStyle = false, endpoint = R2_ENDPOINT
 * - Timeweb S3: forcePathStyle = true, endpoint = S3_ENDPOINT
 */
const s3Client = new S3Client({
  endpoint: isR2 
    ? process.env.R2_ENDPOINT 
    : process.env.S3_ENDPOINT,
  region: isR2 
    ? 'auto' // R2 использует 'auto'
    : (process.env.S3_REGION || 'ru-1'),
  credentials: {
    accessKeyId: isR2
      ? (process.env.R2_ACCESS_KEY_ID || '')
      : (process.env.S3_ACCESS_KEY_ID || ''),
    secretAccessKey: isR2
      ? (process.env.R2_SECRET_ACCESS_KEY || '')
      : (process.env.S3_SECRET_ACCESS_KEY || ''),
  },
  forcePathStyle: !isR2, // false для R2, true для Timeweb S3
})

/**
 * Загрузка файла в S3 bucket с публичным доступом
 * @param buffer - Buffer с данными файла
 * @param key - Путь к файлу в bucket (например, "avatars/business-123.jpg")
 * @param contentType - MIME тип файла (например, "image/jpeg")
 * @returns Публичный URL файла
 */
export async function uploadPublicFile(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const bucketName = isR2
    ? (process.env.R2_BUCKET || process.env.S3_BUCKET_NAME)
    : process.env.S3_BUCKET_NAME

  if (!bucketName) {
    throw new Error(isR2 
      ? 'R2_BUCKET or S3_BUCKET_NAME environment variable is not set'
      : 'S3_BUCKET_NAME environment variable is not set')
  }

  // Загружаем файл в S3/R2
  // R2 не поддерживает ACL, использует bucket policy
  // Timeweb S3 также использует bucket policy для публичного доступа
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  })

  await s3Client.send(command)

  // Формируем публичный URL
  // Используем S3_PUBLIC_URL для обоих хранилищ (R2 и Timeweb S3)
  const publicUrl = process.env.S3_PUBLIC_URL

  if (!publicUrl) {
    throw new Error('S3_PUBLIC_URL environment variable is not set')
  }

  // Убираем trailing slash если есть
  const baseUrl = publicUrl.replace(/\/$/, '')
  const fileKey = key.startsWith('/') ? key : `/${key}`

  return `${baseUrl}${fileKey}`
}

/**
 * Удаление файла из S3 bucket по публичному URL
 * @param publicUrl - Публичный URL файла (например, "https://bucket.s3.timeweb.com/path/to/file.jpg")
 * @returns true при успехе, false при ошибке
 */
export async function deletePublicFileByUrl(publicUrl: string): Promise<boolean> {
  const bucketName = isR2
    ? (process.env.R2_BUCKET || process.env.S3_BUCKET_NAME)
    : process.env.S3_BUCKET_NAME
  
  const s3PublicUrl = process.env.S3_PUBLIC_URL

  if (!bucketName || !s3PublicUrl) {
    console.warn('S3_BUCKET_NAME or S3_PUBLIC_URL environment variable is not set')
    return false
  }

  // Убираем trailing slash если есть
  const baseUrl = s3PublicUrl.replace(/\/$/, '')

  // Проверяем, что URL принадлежит нашему S3
  if (!publicUrl.startsWith(`${baseUrl}/`)) {
    console.warn(`URL does not belong to our S3: ${publicUrl}`)
    return false
  }

  // Извлекаем key из URL (часть после baseUrl/)
  const keyWithLeadingSlash = publicUrl.substring(baseUrl.length)
  const key = keyWithLeadingSlash.startsWith('/') ? keyWithLeadingSlash.substring(1) : keyWithLeadingSlash

  // Декодируем key на всякий случай
  const decodedKey = decodeURIComponent(key)

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: decodedKey,
    })

    await s3Client.send(command)
    return true
  } catch (error) {
    console.warn(`Failed to delete file from S3: ${decodedKey}`, error)
    return false
  }
}
