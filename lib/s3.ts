import { Storage } from '@google-cloud/storage'

/**
 * Инициализация Google Cloud Storage клиента
 * Использует keyFilename из переменной окружения GOOGLE_APPLICATION_CREDENTIALS
 */
const storage = new Storage({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
})

/**
 * Загрузка файла в Google Cloud Storage bucket с публичным доступом
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

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set')
  }

  const bucket = storage.bucket(bucketName)
  const file = bucket.file(key)

  // Загружаем файл
  await file.save(buffer, {
    contentType,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  })

  // Делаем файл публичным
  await file.makePublic()

  // Формируем публичный URL
  // Формат: https://storage.googleapis.com/<bucket>/<key>
  return `https://storage.googleapis.com/${bucketName}/${key}`
}

/**
 * Удаление файла из Google Cloud Storage bucket по публичному URL
 * @param publicUrl - Публичный URL файла (например, "https://storage.googleapis.com/bucket/path/to/file.jpg")
 * @returns true при успехе, false при ошибке
 */
export async function deletePublicFileByUrl(publicUrl: string): Promise<boolean> {
  const bucketName = process.env.GCS_BUCKET

  if (!bucketName || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn('GCS_BUCKET or GOOGLE_APPLICATION_CREDENTIALS environment variable is not set')
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
