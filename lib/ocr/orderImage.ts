import { createWorker, OEM } from 'tesseract.js'
import { segmentNeeds } from '@/lib/orchestrator/segmentNeeds'
import { parseMaxRequestToRows, parseSegment } from '@/lib/parseMaxRequest'

const LOG_MAX = 120

const UNITS = new Set([
  'кг', 'г', 'гр', 'л', 'мл', 'шт', 'уп', 'упак', 'пач', 'пуч', 'кор', 'ящ', 'т', 'м', 'ед',
])

const SERVICE_PATTERNS = [
  /дата\s*заявки/i,
  /фамилия\s*заказчика/i,
  /заказчик\s*товара/i,
  /^[\s|\-]+$/,
]

/** Post-processing: очистка OCR-таблицы (сохраняем | для разбиения на ячейки) */
export function cleanOcrTable(rawText: string): string {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const junkTokens = /\b(wr|kr|кю|rr|rг|гк)(?=\s|$)/gi
  const junkMarkers = /[\*\+\»\©\®]/g

  const cleaned: string[] = []
  for (const line of lines) {
    if (SERVICE_PATTERNS.some((p) => p.test(line)) || line.length < 3) continue
    let s = line.replace(junkMarkers, '')
    s = s.replace(junkTokens, ' ')
    s = s.replace(/\s{2,}/g, ' ').trim()
    if (s.length >= 2) cleaned.push(s)
  }
  return cleaned.join('\n')
}

/** Разбить строку на ячейки по | и большим пробелам */
function splitRowIntoCells(line: string): string[] {
  return line
    .split(/\||\s{3,}/)
    .map((c) => c.trim())
    .filter(Boolean)
}

/** Ячейка — единица измерения? (к = кг, OCR-сокращение) */
function isUnitCell(cell: string): boolean {
  const c = cell.toLowerCase().replace(/\.$/, '')
  if (UNITS.has(c)) return true
  if (c === 'к') return true
  return false
}

/** Ячейка содержит количество + опционально единицу (10кг, 2 кг, 0.200) */
function parseQtyUnitCell(cell: string): { qty: string; unit: string } | null {
  const normalized = cell.replace(/(\d)\s*к\b/gi, '$1 кг').replace(/\bЗ\s*(\d)/g, '3 $1')
  const m = normalized.match(/^(\d+(?:[.,]\d+)?)\s*(кг|г|гр|л|мл|шт|уп|упак|пач|пуч|кор|ящ|т|м|ед)?$/i)
  if (!m) return null
  return {
    qty: m[1].replace(',', '.'),
    unit: (m[2] || 'шт').toLowerCase(),
  }
}

/** Ячейка — только число (количество) */
function isQuantityOnly(cell: string): boolean {
  return /^\d+(?:[.,]\d+)?$/.test(cell.trim())
}

/** Первая ячейка похожа на название товара */
function isProductNameCell(cell: string): boolean {
  if (!cell || cell.length < 2) return false
  if (/^\d+$/.test(cell)) return false
  if (isUnitCell(cell)) return false
  if (SERVICE_PATTERNS.some((p) => p.test(cell))) return false
  return /[\p{L}]/u.test(cell)
}

/**
 * Табличное чтение: валидная строка = название + (единица ИЛИ количество) в соседних ячейках справа.
 * Не берём строку, если справа нет подтверждения.
 */
export function extractTableItems(rows: string[]): string[] {
  const items: string[] = []
  for (const row of rows) {
    const cells = splitRowIntoCells(row)
    if (cells.length < 2) continue

    const name = cells[0].trim()
    if (!isProductNameCell(name)) continue

    let qty = ''
    let unit = 'шт'

    for (let i = 1; i < cells.length; i++) {
      const c = cells[i]
      const parsed = parseQtyUnitCell(c)
      if (parsed) {
        qty = parsed.qty
        unit = parsed.unit
        break
      }
      if (isUnitCell(c)) {
        unit = c === 'к' ? 'кг' : c.toLowerCase()
        if (i + 1 < cells.length && isQuantityOnly(cells[i + 1])) {
          qty = cells[i + 1].replace(',', '.')
        } else {
          qty = '1'
        }
        break
      }
      if (isQuantityOnly(c)) {
        qty = c.replace(',', '.')
        if (i + 1 < cells.length && isUnitCell(cells[i + 1])) {
          unit = cells[i + 1].toLowerCase()
        }
        break
      }
    }

    if (!qty) continue
    items.push(`${name} ${qty} ${unit}`.trim())
  }
  return items
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
 * Process order image: OCR → table cleanup → table extraction → fallback segmentNeeds.
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
  const cleanedRows = cleanedText.split(/\n/).filter(Boolean)

  console.log('[OCR] cleaned rows', cleanedRows.slice(0, 4).join(' | ').slice(0, LOG_MAX) + (cleanedRows.length > 4 ? '...' : ''))

  const subdivision = cleanedRows.find((l) => l.includes(';'))?.trim()

  const tableRows = cleanedRows.filter((r) => r.includes('|') || /\s{3,}/.test(r))
  console.log('[OCR] table rows', tableRows.length, tableRows.slice(0, 3).join(' | ').slice(0, LOG_MAX))

  const tableItems = extractTableItems(cleanedRows)
  console.log('[OCR] validated rows', tableItems.length, tableItems.slice(0, 3).join('; ').slice(0, LOG_MAX))

  let items: string[] = tableItems

  if (items.length === 0) {
    const segments = segmentNeeds(cleanedText)
    for (const seg of segments) {
      const parsed = parseSegment(seg)
      if (parsed) {
        const unit = parsed.unit || 'шт'
        items.push(`${parsed.name} ${parsed.quantity} ${unit}`.trim())
      } else {
        items.push(seg.trim())
      }
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
