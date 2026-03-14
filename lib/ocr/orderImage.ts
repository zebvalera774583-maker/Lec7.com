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
  /^номенклатура$/i,
  /^количество$/i,
  /^ед\.?\s*изм\.?$/i,
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

/** Средняя высота bbox */
function avgBboxHeight(items: { bbox: Bbox }[]): number {
  if (items.length === 0) return 10
  const sum = items.reduce((a, i) => a + (i.bbox.y1 - i.bbox.y0), 0)
  return sum / items.length
}

/** Средняя ширина bbox */
function avgBboxWidth(items: { bbox: Bbox }[]): number {
  if (items.length === 0) return 20
  const sum = items.reduce((a, i) => a + (i.bbox.x1 - i.bbox.x0), 0)
  return sum / items.length
}

/** Группировка слов по строкам: lines как подсказка, words для точности */
function groupWordsByRow(
  words: WordWithBbox[],
  lines: { words: WordWithBbox[]; bbox: Bbox }[]
): WordWithBbox[][] {
  if (lines.length > 0) {
    return lines.map((l) => [...l.words].sort((a, b) => a.bbox.x0 - b.bbox.x0))
  }
  if (words.length === 0) return []
  const avgH = avgBboxHeight(words)
  const toleranceY = Math.max(2, avgH * 0.5)
  const rows: WordWithBbox[][] = []
  const used = new Set<number>()
  for (let i = 0; i < words.length; i++) {
    if (used.has(i)) continue
    const w = words[i]
    const row: WordWithBbox[] = [w]
    used.add(i)
    const midY = (w.bbox.y0 + w.bbox.y1) / 2
    for (let j = i + 1; j < words.length; j++) {
      if (used.has(j)) continue
      const w2 = words[j]
      const midY2 = (w2.bbox.y0 + w2.bbox.y1) / 2
      if (Math.abs(midY - midY2) <= toleranceY) {
        row.push(w2)
        used.add(j)
      }
    }
    row.sort((a, b) => a.bbox.x0 - b.bbox.x0)
    rows.push(row)
  }
  rows.sort((a, b) => (a[0]?.bbox.y0 ?? 0) - (b[0]?.bbox.y0 ?? 0))
  return rows
}

/** Разбить слова строки на ячейки по gap по X (относительно средней ширины) */
function splitRowIntoCellsByGap(rowWords: WordWithBbox[]): string[][] {
  if (rowWords.length === 0) return []
  const avgW = avgBboxWidth(rowWords)
  const gapThreshold = Math.max(avgW * 0.8, 10)
  const cells: string[][] = []
  let current: string[] = []
  let lastX1 = -1
  for (const w of rowWords) {
    const gap = lastX1 >= 0 ? w.bbox.x0 - lastX1 : 0
    if (gap > gapThreshold && current.length > 0) {
      cells.push(current.map((c) => c.trim()).filter(Boolean))
      current = []
    }
    current.push(w.text)
    lastX1 = w.bbox.x1
  }
  if (current.length > 0) {
    cells.push(current.map((c) => c.trim()).filter(Boolean))
  }
  return cells
}

/** Валидация товарной строки: название + единица/количество справа */
function validateTableRowFromCells(cells: string[][]): { name: string; qty: string; unit: string } | null {
  if (cells.length === 0) return null
  const firstCell = cells[0].join(' ').trim()
  if (!isProductNameCell(firstCell)) return null
  let qty = ''
  let unit = 'шт'
  for (let i = 1; i < cells.length; i++) {
    const cellText = cells[i].join(' ').trim()
    const parsed = parseQtyUnitCell(cellText)
    if (parsed) {
      qty = parsed.qty
      unit = parsed.unit
      break
    }
    if (isUnitCell(cellText)) {
      unit = cellText === 'к' ? 'кг' : cellText.toLowerCase()
      if (i + 1 < cells.length) {
        const nextText = cells[i + 1].join(' ').trim()
        if (isQuantityOnly(nextText)) qty = nextText.replace(',', '.')
      }
      if (!qty) qty = '1'
      break
    }
    if (isQuantityOnly(cellText)) {
      qty = cellText.replace(',', '.')
      if (i + 1 < cells.length) {
        const nextText = cells[i + 1].join(' ').trim()
        if (isUnitCell(nextText)) unit = nextText === 'к' ? 'кг' : nextText.toLowerCase()
      }
      break
    }
  }
  if (!qty) return null
  return { name: firstCell, qty, unit }
}

/** Bbox-пайплайн: lines → rows with cells → validated items */
function extractTableItemsFromBbox(
  words: WordWithBbox[],
  lines: { words: WordWithBbox[]; bbox: Bbox }[]
): string[] {
  const rows = groupWordsByRow(words, lines)
  const items: string[] = []
  for (const rowWords of rows) {
    const cells = splitRowIntoCellsByGap(rowWords)
    const validated = validateTableRowFromCells(cells)
    if (validated) {
      items.push(`${validated.name} ${validated.qty} ${validated.unit}`.trim())
    }
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

/** Расширенная нормализация для строк таблицы заявки */
function normalizeTableRowText(row: string): string {
  return (
    row
      .replace(/(\d+(?:[.,]\d+)?)\s*к\b/gi, '$1 кг')
      .replace(/(\d)(кг|г|гр|шт|л|мл|уп)\b/gi, '$1 $2')
      .replace(/\bКГ\.?\s*(\d)/gi, '$1 кг')
      .replace(/\bЗ\s*(\d)/g, '3 $1')
      .replace(/\s{2,}/g, ' ')
      .trim()
  )
}

/** Строка содержит только qty+unit (число + опционально ед.) */
const HAS_QTY_UNIT = /\d+(?:[.,]\d+)?\s*(кг|г|гр|л|мл|шт|уп|упак|пач|пуч|кор|ящ|т|м|ед)?$/i

/** Строка — только название (буквы, без числа) */
function isNameOnly(s: string): boolean {
  const t = s.trim()
  if (!t || t.length < 2) return false
  return /[\p{L}]/u.test(t) && !/\d/.test(t)
}

/** Постобработка строк таблицы: нормализация + склейка разорванных (название + qty+unit) */
export function postProcessTableRows(rows: string[]): string[] {
  const normalized = rows.map(normalizeTableRowText).filter(Boolean)
  const result: string[] = []
  for (let i = 0; i < normalized.length; i++) {
    const row = normalized[i]
    const next = normalized[i + 1]
    if (isNameOnly(row) && next && HAS_QTY_UNIT.test(next)) {
      result.push(`${row} ${next}`.trim())
      i++
      continue
    }
    result.push(row)
  }
  return result
}

type Bbox = { x0: number; y0: number; x1: number; y1: number }
type WordWithBbox = { text: string; bbox: Bbox }

/** OCR с полным выводом (text + words/lines для bbox) */
export async function extractOcrWithBbox(buffer: Buffer): Promise<{
  text: string
  words: WordWithBbox[]
  lines: { words: WordWithBbox[]; bbox: Bbox }[]
}> {
  const worker = await createWorker('rus+eng', OEM.LSTM_ONLY, { logger: () => {} })
  try {
    const imageInput = `data:image/png;base64,${buffer.toString('base64')}`
    const { data } = await worker.recognize(imageInput)
    const text = data.text?.trim() ?? ''
    const words: WordWithBbox[] = (data.words ?? []).map((w: any) => ({
      text: String(w.text ?? '').trim(),
      bbox: w.bbox ?? { x0: 0, y0: 0, x1: 0, y1: 0 },
    })).filter((w) => w.text)
    const lines = (data.lines ?? []).map((line: any) => ({
      words: (line.words ?? []).map((w: any) => ({
        text: String(w.text ?? '').trim(),
        bbox: w.bbox ?? { x0: 0, y0: 0, x1: 0, y1: 0 },
      })).filter((w: any) => w.text),
      bbox: line.bbox ?? { x0: 0, y0: 0, x1: 0, y1: 0 },
    })).filter((l) => l.words.length > 0)
    return { text, words, lines }
  } finally {
    await worker.terminate()
  }
}

/** Extract text only (legacy) */
export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const { text } = await extractOcrWithBbox(buffer)
  return text
}

/**
 * Process order image: OCR → bbox pipeline (приоритет) → text fallback.
 * Returns cleaned text, parsed items, and optional subdivision.
 */
export async function processOrderImage(
  buffer: Buffer
): Promise<{ text: string; items: string[]; subdivision?: string }> {
  const { text: rawText, words, lines } = await extractOcrWithBbox(buffer)
  if (!rawText.trim()) {
    return { text: '', items: [] }
  }

  console.log('[OCR] raw text', rawText.slice(0, LOG_MAX) + (rawText.length > LOG_MAX ? '...' : ''))
  if (words.length > 0 || lines.length > 0) {
    const debugSample = words.slice(0, 8).map((w) => `${w.text}@${w.bbox.x0},${w.bbox.y0}`)
    console.log('[OCR] bbox debug', { words: words.length, lines: lines.length, sample: debugSample.join(' ') })
  }

  const bboxItems = extractTableItemsFromBbox(words, lines)
  console.log('[OCR] bbox items', bboxItems.length, bboxItems.slice(0, 3).join('; ').slice(0, LOG_MAX))

  let items: string[] = bboxItems

  const cleanedRaw = cleanOcrTable(rawText)
  const cleanedText = normalizeOcrUnits(cleanedRaw)
  const cleanedRows = cleanedText.split(/\n/).filter(Boolean)
  const subdivision = cleanedRows.find((l) => l.includes(';'))?.trim()

  if (items.length === 0) {
    console.log('[OCR] cleaned rows (fallback)', cleanedRows.slice(0, 4).join(' | ').slice(0, LOG_MAX) + (cleanedRows.length > 4 ? '...' : ''))
    const tableItems = extractTableItems(cleanedRows)
    console.log('[OCR] text validated rows', tableItems.length, tableItems.slice(0, 3).join('; ').slice(0, LOG_MAX))
    items = tableItems
  }

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
