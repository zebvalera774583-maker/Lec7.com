import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'ru-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Для S3-compatible storage
})

const BUCKET_NAME = process.env.S3_BUCKET_NAME!
const PUBLIC_URL = process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT

/**
 * Загрузка файла в S3
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  })

  await s3Client.send(command)

  // Возвращаем публичный URL
  return `${PUBLIC_URL}/${key}`
}

/**
 * Удаление файла из S3
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  await s3Client.send(command)
}

/**
 * Получение подписанного URL для временного доступа
 */
export async function getSignedFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  return getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Генерация ключа для файла портфолио
 */
export function getPortfolioKey(businessId: string, filename: string): string {
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `portfolios/${businessId}/${timestamp}-${sanitizedFilename}`
}

/**
 * Генерация ключа для документа
 */
export function getDocumentKey(businessId: string, documentId: string, filename: string): string {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `documents/${businessId}/${documentId}/${sanitizedFilename}`
}
