import { Storage } from '@google-cloud/storage'
import { GoogleAuth } from 'google-auth-library'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? 'gcs'

// --- GCS driver ---
const gcsStorage = new Storage()

async function uploadGcs(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const bucketName = process.env.GCS_BUCKET
  if (!bucketName) {
    throw new Error('GCS_BUCKET environment variable is not set')
  }

  try {
    const bucket = gcsStorage.bucket(bucketName)
    const file = bucket.file(key)

    await file.save(buffer, {
      contentType,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    })

    return `https://storage.googleapis.com/${bucketName}/${key}`
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    console.error('[GCS Upload Error]', {
      code: err?.code,
      message: err?.message,
      bucket: bucketName,
      key,
    })

    if (process.env.GCS_DEBUG_IDENTITY === '1') {
      try {
        const auth = new GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        })
        const credentials = await auth.getCredentials()
        console.error('[GCS Identity]', {
          serviceAccount: credentials.client_email || 'unknown',
          project: process.env.GOOGLE_CLOUD_PROJECT || 'not set',
        })
      } catch (authError: unknown) {
        const ae = authError as { message?: string }
        console.warn('[GCS Identity] Failed to get identity:', ae?.message)
      }
    }

    throw error
  }
}

async function deleteGcsByUrl(publicUrl: string): Promise<boolean> {
  const bucketName = process.env.GCS_BUCKET
  if (!bucketName) {
    console.warn('GCS_BUCKET environment variable is not set')
    return false
  }

  const expectedPrefix = `https://storage.googleapis.com/${bucketName}/`
  if (!publicUrl.startsWith(expectedPrefix)) {
    console.warn(`URL does not belong to our GCS bucket: ${publicUrl}`)
    return false
  }

  const key = decodeURIComponent(publicUrl.substring(expectedPrefix.length))

  try {
    const bucket = gcsStorage.bucket(bucketName)
    const file = bucket.file(key)
    await file.delete()
    return true
  } catch (error) {
    console.warn(`Failed to delete file from GCS: ${key}`, error)
    return false
  }
}

// --- S3 driver ---
let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    const endpoint = process.env.S3_ENDPOINT
    const region = process.env.S3_REGION || 'ru-1'
    const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? ''
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? ''

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error('S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY must be set for S3 driver')
    }

    s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    })
  }
  return s3Client
}

async function uploadS3(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const bucket = process.env.S3_BUCKET
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL

  if (!bucket) {
    throw new Error('S3_BUCKET environment variable is not set')
  }
  if (!publicBaseUrl) {
    throw new Error('S3_PUBLIC_BASE_URL environment variable is not set')
  }

  const client = getS3Client()

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000',
      })
    )

    const base = publicBaseUrl.replace(/\/$/, '')
    return `${base}/${key}`
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('[S3 Upload Error]', {
      message: err?.message,
      bucket,
      key,
    })
    throw error
  }
}

async function deleteS3ByUrl(publicUrl: string): Promise<boolean> {
  const bucket = process.env.S3_BUCKET
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL

  if (!bucket || !publicBaseUrl) {
    return false
  }

  const base = publicBaseUrl.replace(/\/$/, '')
  const expectedPrefix = `${base}/`
  if (!publicUrl.startsWith(expectedPrefix)) {
    console.warn(`URL does not belong to our S3 bucket: ${publicUrl}`)
    return false
  }

  const key = decodeURIComponent(publicUrl.substring(expectedPrefix.length))

  try {
    const client = getS3Client()
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    )
    return true
  } catch (error) {
    console.warn(`Failed to delete file from S3: ${key}`, error)
    return false
  }
}

// --- Public API ---

export async function uploadPublicFile(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  if (STORAGE_DRIVER === 's3') {
    return uploadS3(buffer, key, contentType)
  }
  return uploadGcs(buffer, key, contentType)
}

export async function deletePublicFileByUrl(publicUrl: string): Promise<boolean> {
  if (STORAGE_DRIVER === 's3') {
    return deleteS3ByUrl(publicUrl)
  }
  return deleteGcsByUrl(publicUrl)
}
