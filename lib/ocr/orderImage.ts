import { createWorker } from 'tesseract.js'
import { segmentNeeds } from '@/lib/orchestrator/segmentNeeds'
import { parseMaxRequestToRows, parseSegment } from '@/lib/parseMaxRequest'

/**
 * Extract text from image buffer using tesseract.js (rus+eng).
 */
export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const worker = await createWorker(['rus', 'eng'], 1, {
    logger: () => {},
  })
  try {
    const ret = await worker.recognize(buffer)
    return ret.data.text?.trim() ?? ''
  } finally {
    await worker.terminate()
  }
}

/**
 * Process order image: OCR → segmentNeeds → parseMaxRequest.
 * Returns raw text, parsed items as strings, and optional subdivision (header line).
 */
export async function processOrderImage(
  buffer: Buffer
): Promise<{ text: string; items: string[]; subdivision?: string }> {
  const text = await extractTextFromImage(buffer)
  if (!text.trim()) {
    return { text: '', items: [] }
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const subdivision = lines.find((l) => l.includes(';'))?.trim()

  const segments = segmentNeeds(text)
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
    const rows = parseMaxRequestToRows('', text)
    for (const r of rows) {
      const unit = r.unit || 'шт'
      items.push(`${r.name} ${r.quantity} ${unit}`.trim())
    }
  }

  return { text, items, subdivision }
}
