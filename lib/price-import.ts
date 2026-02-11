/**
 * Price list import: parse xlsx/xls/csv into normalized items
 */

import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export type ImportItem = {
  title: string
  price: number | null
  unit?: string | null
  sku?: string | null
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20MB

// Column header patterns (case-insensitive)
const TITLE_PATTERNS = /^(наименование|товар|позиция|name|title|название)$/i
const PRICE_PATTERNS = /^(цена|price|стоимость|сумма)$/i
const UNIT_PATTERNS = /^(ед|ед\.|единица|unit|ед\.?\s*изм)$/i
const SKU_PATTERNS = /^(артикул|sku|код)$/i

function matchHeader(h: string, patterns: RegExp): boolean {
  return patterns.test(String(h || '').trim())
}

/**
 * Parse price string: "1 200,50" or "1200.50" -> number
 */
function parsePrice(val: unknown): number | null {
  if (val == null || val === '') return null
  const s = String(val).trim()
  if (!s) return null
  // Replace spaces, normalize comma to dot
  const normalized = s.replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(normalized)
  return Number.isNaN(num) ? null : num
}

/**
 * Extract businessId from path like /api/office/businesses/[id]/price-lists/import/parse
 */
export function getBusinessIdFromPath(pathname: string): string | null {
  const parts = pathname.split('/')
  const idx = parts.indexOf('businesses')
  if (idx === -1 || idx + 1 >= parts.length) return null
  return parts[idx + 1] || null
}

export function assertFileSize(size: number): void {
  if (size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Файл слишком большой. Максимум ${MAX_FILE_SIZE_BYTES / 1024 / 1024} МБ`)
  }
}

export function parseFileToItems(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): { items: ImportItem[]; warnings: string[] } {
  const warnings: string[] = []
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const mime = (mimeType || '').toLowerCase()

  let rows: string[][] = []

  if (ext === 'csv' || mime.includes('csv') || mime.includes('text/plain')) {
    const csvText = buffer.toString('utf-8')
    const result = Papa.parse<string[]>(csvText, {
      skipEmptyLines: true,
      download: false,
      worker: false,
    })
    rows = (result.data || []) as string[][]
    if (result.errors.length > 0) {
      warnings.push(`Ошибки при разборе CSV: ${result.errors.slice(0, 3).map((e) => e.message).join('; ')}`)
    }
  } else if (['xlsx', 'xls'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
    const firstSheet = wb.SheetNames[0]
    if (!firstSheet) {
      throw new Error('В файле нет листов')
    }
    const ws = wb.Sheets[firstSheet]
    const aoa = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false })
    rows = aoa as string[][]
  } else {
    throw new Error(`Неподдерживаемый формат файла. Используйте .xlsx, .xls или .csv`)
  }

  if (!rows || rows.length === 0) {
    throw new Error('Файл пуст или не содержит данных')
  }

  // Detect header row and column indices
  const firstRow = rows[0].map((c) => String(c || '').trim())
  let titleCol = 0
  let priceCol = 1
  let unitCol: number | null = null
  let skuCol: number | null = null

  const hasLikelyHeaders = firstRow.some((h) => matchHeader(h, TITLE_PATTERNS) || matchHeader(h, PRICE_PATTERNS))
  if (hasLikelyHeaders) {
    firstRow.forEach((h, i) => {
      if (matchHeader(h, TITLE_PATTERNS)) titleCol = i
      if (matchHeader(h, PRICE_PATTERNS)) priceCol = i
      if (matchHeader(h, UNIT_PATTERNS)) unitCol = i
      if (matchHeader(h, SKU_PATTERNS)) skuCol = i
    })
  }

  const dataStart = hasLikelyHeaders ? 1 : 0
  const items: ImportItem[] = []
  let noPriceCount = 0

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] || []
    const title = String(row[titleCol] ?? '').trim()
    if (!title) continue

    const priceVal = row[priceCol]
    const price = parsePrice(priceVal)
    if (price == null && title) noPriceCount++

    const unit = unitCol != null ? String(row[unitCol] ?? '').trim() || null : null
    const sku = skuCol != null ? String(row[skuCol] ?? '').trim() || null : null

    items.push({
      title,
      price,
      unit: unit || undefined,
      sku: sku || undefined,
    })
  }

  if (noPriceCount > 0) {
    warnings.push(`Не удалось распознать цену в ${noPriceCount} строках`)
  }

  return { items, warnings }
}
