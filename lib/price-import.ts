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

// Service columns to skip (first column)
const INDEX_PATTERNS = /^(№|№\s*п\/п|n|index|номер)$/i

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
  const normalized = s.replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(normalized)
  return Number.isNaN(num) ? null : num
}

/**
 * Check if value looks like a number (for detecting numeric columns)
 */
function looksNumeric(val: unknown): boolean {
  if (val == null || val === '') return false
  const s = String(val).trim()
  if (!s) return false
  const normalized = s.replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(normalized)
  return !Number.isNaN(num)
}

/**
 * Check if cell is pure number (for header vs text detection)
 */
function isPureNumber(val: string): boolean {
  const s = val.trim()
  if (!s) return false
  const norm = s.replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(norm)
  if (Number.isNaN(num)) return false
  // Allow integer or decimal
  return /^[\d\s.,\-]+$/.test(s)
}

/**
 * Check if title is junk: pure number or too short
 */
function isJunkTitle(title: string): boolean {
  const t = title.trim()
  if (t.length < 3) return true
  return isPureNumber(t)
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

/**
 * Find real table header inside Excel: scan first maxScan rows.
 * Header row: ≥3 non-empty cells, ≥2 text cells, contains text, not only numbers,
 * not single "№ п/п". Prefer row with TITLE_PATTERNS (наименование etc).
 */
function findHeaderRow(rows: string[][], maxScan: number): number {
  const scan = Math.min(maxScan, rows.length)
  const candidates: number[] = []

  for (let r = 0; r < scan; r++) {
    const row = rows[r] || []
    const cells = row.map((c) => String(c ?? '').trim())
    const nonEmpty = cells.filter((c) => c.length > 0)

    if (nonEmpty.length < 3) continue

    const textCells = nonEmpty.filter((c) => !isPureNumber(c))
    if (textCells.length < 2) continue

    if (nonEmpty.length === 1 && matchHeader(nonEmpty[0], INDEX_PATTERNS)) continue

    if (row.some((c) => matchHeader(c, TITLE_PATTERNS))) {
      console.log('Detected header row index:', r)
      return r
    }
    candidates.push(r)
  }

  if (candidates.length > 0) {
    const index = candidates[0]
    console.log('Detected header row index:', index)
    return index
  }

  return 0
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

  const headerRowIdx = findHeaderRow(rows, 30)
  const headerRow = rows[headerRowIdx].map((c) => String(c || '').trim())

  // 1. Skip index column if first column matches
  let colOffset = 0
  if (matchHeader(headerRow[0], INDEX_PATTERNS)) {
    colOffset = 1
  }

  let titleCol = colOffset
  let priceCol = colOffset + 1
  let unitCol: number | null = null
  let skuCol: number | null = null

  const hasLikelyHeaders = headerRow.some(
    (h) => matchHeader(h, TITLE_PATTERNS) || matchHeader(h, PRICE_PATTERNS)
  )

  if (hasLikelyHeaders) {
    headerRow.forEach((h, i) => {
      if (i < colOffset) return
      const idx = i
      if (matchHeader(h, TITLE_PATTERNS)) titleCol = idx
      if (matchHeader(h, PRICE_PATTERNS)) priceCol = idx
      if (matchHeader(h, UNIT_PATTERNS)) unitCol = idx
      if (matchHeader(h, SKU_PATTERNS)) skuCol = idx
    })
  }

  const dataStart = hasLikelyHeaders ? headerRowIdx + 1 : 0
  const items: ImportItem[] = []
  let noPriceCount = 0

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] || []
    const nonEmptyCount = row.filter((c) => String(c ?? '').trim().length > 0).length
    if (nonEmptyCount < 2) continue

    const title = String(row[titleCol] ?? '').trim()
    if (!title) continue

    if (isJunkTitle(title)) continue

    let price = parsePrice(row[priceCol])

    // 3. If price not found — try adjacent numeric columns (right of title)
    if (price == null) {
      const colsToTry = [
        priceCol,
        titleCol + 1,
        titleCol + 2,
        titleCol + 3,
      ].filter((c) => c !== titleCol && c >= 0 && c < row.length)
      for (const c of colsToTry) {
        const val = row[c]
        if (looksNumeric(val)) {
          price = parsePrice(val)
          if (price != null) break
        }
      }
    }

    if (price == null) noPriceCount++

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

  // 5. UX: if 70%+ rows without price — add structural warning
  if (items.length > 0 && noPriceCount / items.length >= 0.7) {
    warnings.push('⚠ Возможно, файл имеет сложную структуру. Проверьте, что в таблице есть колонки «Наименование» и «Цена».')
  }

  return { items, warnings }
}
