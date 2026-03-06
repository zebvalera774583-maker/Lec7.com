import { createWorker, OEM } from 'tesseract.js'
import { segmentNeeds } from '@/lib/orchestrator/segmentNeeds'
import { parseMaxRequestToRows, parseSegment } from '@/lib/parseMaxRequest'

const LOG_MAX = 120

/** Post-processing: очистка OCR-таблицы под формат заявки */
export function cleanOcrTable(rawText: string): string {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const servicePatterns = [
    /дата\s*заявки/i,
    /фамилия\s*заказчика/i,
    /заказчик\s*товара/i,
    /^[\s|\-]+$/, // только разделители
  ]
  const isServiceLine = (line: string) =>
    servicePatterns.some((p) => p.test(line)) || line.length < 3

  const junkTokens = /\b(wr|kr|кю|rr|rг|гк)(?=\s|$)/gi
  const junkMarkers = /[\*\+\»\©\®]/g

  const cleaned: string[] = []
  for (const line of lines) {
    if (isServiceLine(line)) continue
    let s = line.replace(/\|/g, ' ')
    s = s.replace(junkMarkers, '')
    s = s.replace(junkTokens, ' ')
    s = s.replace(/\s{2,}/g, ' ').trim()
    if (s.length >= 2) cleaned.push(s)
  }

  return cleaned.join('\n')
}

/** Нормализация OCR-опечаток: 10к→10 кг, Зкг→3 кг */
export function normalizeOcrUnits(text: string): string {
  return text
    .replace(/(\d+(?:[.,]\d+)?)\s*к\b/gi, '$1 кг')
    .replace(/(\d+(?:[.,]\d+)?)\s*Зкг/gi, '$1 кг')
    .replace(/\bЗ\s*(\d)/g, '3 $1')
}

/**
 * Extract text from image buffer using tesseract.js (rus+eng).
 */
export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const worker = await createWorker('rus+eng', OEM.LSTM_ONLY, { logger: () => {} })
  try {
    const imageInput = `data:image/png;base64,${buffer.toString('base64')}`
    const { data } = await worker.recognize(imageInput)
    return data.text?.trim() ?? ''
  } finally {
    await worker.terminate()
  }
}

/**
 * Process order image: OCR → table cleanup → segmentNeeds/parseMaxRequest.
 * Returns cleaned text, parsed items, and optional subdivision.
 */
export async function processOrderImage(
  buffer: Buffer
): Promise<{ text: string; items: string[]; subdivision?: string }> {
  const rawText = await extractTextFromImage(buffer)
  if (!rawText.trim()) {
    return { text: '', items: [] }
  }

  console.log('[OCR] raw text', rawText.slice(0, LOG_MAX) + (rawText.length > LOG_MAX ? '...' : ''))

  const cleanedRaw = cleanOcrTable(rawText)
  const cleanedText = normalizeOcrUnits(cleanedRaw)
  const cleanedLines = cleanedText.split(/\n/).filter(Boolean)

  console.log('[OCR] cleaned lines', cleanedLines.slice(0, 5).join(' | ').slice(0, LOG_MAX) + (cleanedLines.length > 5 ? '...' : ''))

  const subdivision = cleanedLines.find((l) => l.includes(';'))?.trim()

  const segments = segmentNeeds(cleanedText)
  const items: string[] = []
  for (const seg of segments) {
    const parsed = parseSegment(seg)
    if (parsed) {
      const unit = parsed.unit || 'шт'
      items.push(`${parsed.name} ${parsed.quantity} ${unit}`.trim())
    } else {
      items.push(seg.trim())
    }
  }

  if (items.length === 0) {
    const rows = parseMaxRequestToRows('', cleanedText)
    for (const r of rows) {
      const unit = r.unit || 'шт'
      items.push(`${r.name} ${r.quantity} ${unit}`.trim())
    }
  }

  console.log('[OCR] extracted items', items.slice(0, 5).join('; ').slice(0, LOG_MAX) + (items.length > 5 ? '...' : ''))

  return { text: cleanedText, items, subdivision }
}
