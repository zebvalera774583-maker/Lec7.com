import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

/**
 * Инициализация S3 клиента для Timeweb S3
 * forcePathStyle = true обязателен для Timeweb S3
 */
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'ru-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true, // ОБЯЗАТЕЛЬНО для Timeweb S3
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
  const bucketName = process.env.S3_BUCKET_NAME

  if (!bucketName) {
    throw new Error('S3_BUCKET_NAME environment variable is not set')
  }

  // Загружаем файл в S3
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read', // Публичный доступ для чтения
  })

  await s3Client.send(command)

  // Формируем публичный URL
  const publicUrl = process.env.S3_PUBLIC_URL
  if (!publicUrl) {
    throw new Error('S3_PUBLIC_URL environment variable is not set')
  }

  // Убираем trailing slash если есть
  const baseUrl = publicUrl.replace(/\/$/, '')
  const fileKey = key.startsWith('/') ? key : `/${key}`

  return `${baseUrl}${fileKey}`
}
