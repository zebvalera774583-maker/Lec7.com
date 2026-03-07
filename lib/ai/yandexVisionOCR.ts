/**
 * Yandex Vision OCR — распознавание текста с изображений заявок.
 * POST https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText
 *
 * Env: YANDEX_API_KEY, YANDEX_FOLDER_ID
 */

const OCR_URL = 'https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText'
const LOG_MAX = 200

/** Извлечь текст из ответа Yandex Vision OCR (blocks -> lines -> text) */
function extractTextFromResponse(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const obj = data as Record<string, unknown>

  // result или textAnnotation (разные версии API)
  const root = (obj.result ?? obj.textAnnotation ?? obj) as Record<string, unknown> | undefined
  if (!root) return ''

  const directText = root.text
  if (typeof directText === 'string' && directText.trim()) return directText.trim()

  const blocks = root.blocks as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(blocks)) return ''

  const lines: string[] = []
  for (const block of blocks) {
    const blockLines = block.lines as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(blockLines)) continue
    for (const line of blockLines) {
      const text = line.text
      if (typeof text === 'string' && text.trim()) lines.push(text.trim())
    }
  }
  return lines.join('\n')
}

/**
 * Распознать текст с изображения через Yandex Vision OCR.
 * @param buffer — буфер изображения (PNG/JPEG)
 * @returns распознанный текст
 */
export async function recognizeImage(buffer: Buffer): Promise<string> {
  const apiKey = process.env.YANDEX_API_KEY?.trim()
  const folderId = process.env.YANDEX_FOLDER_ID?.trim()

  if (!apiKey || !folderId) {
    throw new Error('YANDEX_API_KEY and YANDEX_FOLDER_ID are required for Yandex Vision OCR')
  }

  const content = buffer.toString('base64')
  const body = {
    mimeType: 'image/png',
    languageCodes: ['ru'],
    model: 'table',
    content,
  }

  const res = await fetch(OCR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Api-Key ${apiKey}`,
      'x-folder-id': folderId,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[Yandex Vision OCR] error', res.status, errText.slice(0, 300))
    throw new Error(`Yandex Vision OCR failed: ${res.status} ${errText.slice(0, 100)}`)
  }

  const data = (await res.json()) as unknown
  const text = extractTextFromResponse(data)

  const logPreview = text.slice(0, LOG_MAX) + (text.length > LOG_MAX ? '...' : '')
  console.log('[Yandex Vision OCR] result length:', text.length, 'preview:', logPreview)

  return text
}
