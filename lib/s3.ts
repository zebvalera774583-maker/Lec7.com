import { Storage } from '@google-cloud/storage'
import { GoogleAuth } from 'google-auth-library'

/**
 * Инициализация Google Cloud Storage клиента
 * Использует Application Default Credentials (ADC)
 * На Google Compute Engine автоматически использует default service account
 */
const storage = new Storage()

/**
 * Загрузка файла в Google Cloud Storage bucket с Uniform bucket-level access
 * Публичный доступ настраивается через IAM bucket policy, а не через ACL объектов
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
  const bucketName = process.env.GCS_BUCKET

  if (!bucketName) {
    throw new Error('GCS_BUCKET environment variable is not set')
  }

  try {
    const bucket = storage.bucket(bucketName)
    const file = bucket.file(key)

    // Загружаем файл
    // При Uniform bucket-level access не используем ACL на объектах
    await file.save(buffer, {
      contentType,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    })

    // Формируем публичный URL
    // Формат: https://storage.googleapis.com/<bucket>/<key>
    return `https://storage.googleapis.com/${bucketName}/${key}`
  } catch (error: any) {
    // Всегда логируем базовую информацию об ошибке
    console.error('[GCS Upload Error]', {
      code: error.code,
      message: error.message,
      bucket: bucketName,
      key,
    })

    // Identity логируем только если установлен флаг GCS_DEBUG_IDENTITY=1
    if (process.env.GCS_DEBUG_IDENTITY === '1') {
      try {
        const auth = new GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        })
        const client = await auth.getClient()
        const credentials = await client.getCredentials()
        console.error('[GCS Identity]', {
          serviceAccount: credentials.client_email || 'unknown',
          project: process.env.GOOGLE_CLOUD_PROJECT || 'not set',
        })
      } catch (authError: any) {
        // Не падаем, если auth не получился
        console.warn('[GCS Identity] Failed to get identity:', authError.message)
      }
    }

    throw error
  }
}

/**
 * Удаление файла из Google Cloud Storage bucket по публичному URL
 * @param publicUrl - Публичный URL файла (например, "https://storage.googleapis.com/bucket/path/to/file.jpg")
 * @returns true при успехе, false при ошибке
 */
export async function deletePublicFileByUrl(publicUrl: string): Promise<boolean> {
  const bucketName = process.env.GCS_BUCKET

  if (!bucketName) {
    console.warn('GCS_BUCKET environment variable is not set')
    return false
  }

  // Проверяем, что URL принадлежит нашему bucket
  const expectedPrefix = `https://storage.googleapis.com/${bucketName}/`
  if (!publicUrl.startsWith(expectedPrefix)) {
    console.warn(`URL does not belong to our GCS bucket: ${publicUrl}`)
    return false
  }

  // Извлекаем key из URL (часть после bucket/)
  const key = publicUrl.substring(expectedPrefix.length)
  const decodedKey = decodeURIComponent(key)

  try {
    const bucket = storage.bucket(bucketName)
    const file = bucket.file(decodedKey)
    await file.delete()
    return true
  } catch (error) {
    console.warn(`Failed to delete file from GCS: ${decodedKey}`, error)
    return false
  }
}
