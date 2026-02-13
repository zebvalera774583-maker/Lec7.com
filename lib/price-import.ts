/**
 * Price list import: parse xlsx/xls/csv/pdf/docx into normalized items
 */

import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

export type ImportItem = {
  title: string
  price: number | null
  priceWithVat?: number | null
  priceWithoutVat?: number | null
  unit?: string | null
  sku?: string | null
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20MB

// Title column patterns (для поиска header)
const TITLE_PATTERNS = /^(наименование|товар|позиция|name|title|название)$/i

// Заголовки, которые НЕ должны импортироваться как позиции
const TITLE_ROW_SKIP = /^(наименование\s+товара|наименование|товар|номенклатура|позиция|наименование\s+продукции)$/i

// Колонки, которые выглядят как заголовки
const COLUMN_HEADER_LIKE = /^(ед\.?\s*изм|единица|цена|цена\s*с\s*ндс|цена\s*без\s*ндс|с\s*ндс|без\s*ндс|сумма)$/i

// Price column patterns
const PRICE_VAT_PATTERNS = /(с\s*ндс|вкл\.?\s*ндс|включая\s*ндс)/i
const PRICE_NO_VAT_PATTERNS = /(без\s*ндс|без\s*учёта\s*ндс)/i
const PRICE_GENERIC = /^(цена|price|стоимость|сумма)$/i

// Unit patterns (расширенные)
const UNIT_PATTERNS =
  /^(ед|ед\.|ед\.?\s*изм|единица|единицы|уп|упак|упаковка|фас|кг|г|л|мл|шт|штук|пуч|пучок|ящ|ящик|кор|короб|крт|коробка)$/i

const SKU_PATTERNS = /^(артикул|sku|код)$/i

const INDEX_PATTERNS = /^(№|№\s*п\/п|n|index|номер)$/i

function matchHeader(h: string, patterns: RegExp): boolean {
  return patterns.test(String(h || '').trim())
}

function parsePrice(val: unknown): number | null {
  if (val == null || val === '') return null
  const s = String(val).trim()
  if (!s) return null
  const normalized = s.replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(normalized)
  return Number.isNaN(num) ? null : num
}

function looksNumeric(val: unknown): boolean {
  if (val == null || val === '') return false
  const s = String(val).trim()
  if (!s) return false
  const normalized = s.replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(normalized)
  return !Number.isNaN(num)
}

function isPureNumber(val: string): boolean {
  const s = val.trim()
  if (!s) return false
  const norm = s.replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(norm)
  if (Number.isNaN(num)) return false
  return /^[\d\s.,\-]+$/.test(s)
}

function isJunkTitle(title: string): boolean {
  const t = title.trim()
  if (t.length < 3) return true
  return isPureNumber(t)
}

/**
 * Строка похожа на заголовок (не импортировать как позицию)
 */
function isHeaderLikeRow(row: string[], titleCol: number): boolean {
  const title = String(row[titleCol] ?? '').trim()
  if (matchHeader(title, TITLE_ROW_SKIP)) return true
  if (row.some((c) => matchHeader(String(c ?? ''), COLUMN_HEADER_LIKE))) return true
  return false
}

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

/**
 * Проверить, содержит ли ячейка допустимую единицу измерения
 */
function isValidUnit(val: string): boolean {
  const s = val.trim()
  if (!s || s.length > 20) return false
  return UNIT_PATTERNS.test(s) || /^[а-яёa-z]{1,10}$/i.test(s)
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
    if (!firstSheet) throw new Error('В файле нет листов')
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

  let colOffset = 0
  if (matchHeader(headerRow[0], INDEX_PATTERNS)) {
    colOffset = 1
  }

  let titleCol = colOffset
  let priceWithVatCol: number | null = null
  let priceWithoutVatCol: number | null = null
  let unitCol: number | null = null
  let skuCol: number | null = null

  const hasLikelyHeaders = headerRow.some(
    (h) => matchHeader(h, TITLE_PATTERNS) || PRICE_GENERIC.test(h) || UNIT_PATTERNS.test(h)
  )

  if (hasLikelyHeaders) {
    headerRow.forEach((h, i) => {
      if (i < colOffset) return
      const idx = i
      const cell = String(h || '').trim()
      if (matchHeader(cell, TITLE_PATTERNS)) titleCol = idx
      if (UNIT_PATTERNS.test(cell)) unitCol = idx
      if (matchHeader(cell, SKU_PATTERNS)) skuCol = idx

      if (PRICE_NO_VAT_PATTERNS.test(cell)) {
        priceWithoutVatCol = idx
      } else if (PRICE_VAT_PATTERNS.test(cell)) {
        priceWithVatCol = idx
      } else if (PRICE_GENERIC.test(cell) && priceWithVatCol == null) {
        priceWithVatCol = idx
      }
    })
  }

  if (priceWithVatCol == null && priceWithoutVatCol == null && hasLikelyHeaders) {
    const genericPrice = headerRow.findIndex((h, i) => i >= colOffset && PRICE_GENERIC.test(h))
    if (genericPrice >= 0) priceWithVatCol = genericPrice
  }

  const dataStart = hasLikelyHeaders ? headerRowIdx + 1 : 0

  let defaultUnit: string | null = null
  if (unitCol != null) {
    for (let r = dataStart; r < Math.min(dataStart + 20, rows.length); r++) {
      const val = String(rows[r]?.[unitCol] ?? '').trim()
      if (isValidUnit(val)) {
        defaultUnit = val
        break
      }
    }
    if (!defaultUnit && headerRowIdx > 0) {
      const aboveRow = rows[headerRowIdx - 1] || []
      for (let c = 0; c < aboveRow.length; c++) {
        const val = String(aboveRow[c] ?? '').trim()
        if (isValidUnit(val)) {
          defaultUnit = val
          break
        }
        const afterColon = val.split(/:\s*/).pop()?.trim()
        if (afterColon && isValidUnit(afterColon)) {
          defaultUnit = afterColon
          break
        }
      }
    }
    if (!defaultUnit) {
      const adj = [unitCol - 1, unitCol + 1].filter((c) => c >= 0 && c < headerRow.length)
      for (const c of adj) {
        const val = String(headerRow[c] ?? '').trim()
        if (isValidUnit(val)) {
          defaultUnit = val
          break
        }
      }
    }
  }

  console.log('Columns:', {
    titleCol,
    priceWithVatCol,
    priceWithoutVatCol,
    unitCol,
    skuCol,
    defaultUnit,
  })

  const items: ImportItem[] = []
  let noPriceCount = 0

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] || []
    const nonEmptyCount = row.filter((c) => String(c ?? '').trim().length > 0).length
    if (nonEmptyCount < 2) continue

    const title = String(row[titleCol] ?? '').trim()
    if (!title) continue

    if (isJunkTitle(title)) continue
    if (isHeaderLikeRow(row, titleCol)) continue

    let priceWithVat: number | null = null
    let priceWithoutVat: number | null = null

    if (priceWithVatCol != null) {
      priceWithVat = parsePrice(row[priceWithVatCol])
    }
    if (priceWithoutVatCol != null) {
      priceWithoutVat = parsePrice(row[priceWithoutVatCol])
    }

    if (priceWithVat == null && priceWithoutVat == null) {
      const colsToTry = [
        priceWithVatCol,
        priceWithoutVatCol,
        titleCol + 1,
        titleCol + 2,
        titleCol + 3,
      ].filter((c): c is number => c != null && c !== titleCol && c >= 0 && c < row.length)
      for (const c of colsToTry) {
        const val = row[c]
        if (looksNumeric(val)) {
          const p = parsePrice(val)
          if (p != null) {
            priceWithVat = p
            break
          }
        }
      }
    }

    if (priceWithVat == null && priceWithoutVat == null) noPriceCount++

    let unit = unitCol != null ? String(row[unitCol] ?? '').trim() || null : null
    if (!unit && defaultUnit) unit = defaultUnit
    const sku = skuCol != null ? String(row[skuCol] ?? '').trim() || null : null

    const price = priceWithVat ?? priceWithoutVat

    items.push({
      title,
      price,
      priceWithVat: priceWithVat ?? undefined,
      priceWithoutVat: priceWithoutVat ?? undefined,
      unit: unit || undefined,
      sku: sku || undefined,
    })
  }

  if (noPriceCount > 0) {
    warnings.push(`Не удалось распознать цену в ${noPriceCount} строках`)
  }

  if (items.length > 0 && noPriceCount / items.length >= 0.7) {
    warnings.push('⚠ Возможно, файл имеет сложную структуру. Проверьте, что в таблице есть колонки «Наименование» и «Цена».')
  }

  return { items, warnings }
}

/**
 * Извлечь текст из PDF
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    return (result?.text || '').trim()
  } finally {
    await parser.destroy()
  }
}

/**
 * Извлечь текст из DOCX
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return (result?.value || '').trim()
}

const PRICELIST_AI_PROMPT = `Ты получаешь текст прайс-листа. Верни JSON массив объектов:
{ "title": string, "price": number, "unit": string, "category": string }

Только валидный JSON массив, без markdown и пояснений.`

type AIPriceItem = { title?: string; price?: number; unit?: string; category?: string }

/**
 * Распознать позиции прайса через AI-gateway
 */
export async function parsePricelistWithAI(text: string): Promise<ImportItem[]> {
  const gatewayUrl = process.env.LEC7_AI_GATEWAY_URL
  const gatewaySecret = process.env.LEC7_GATEWAY_SECRET

  if (!gatewayUrl || !gatewaySecret) {
    throw new Error('AI gateway configuration is missing')
  }

  const response = await fetch(`${gatewayUrl}/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LEC7-GATEWAY-SECRET': gatewaySecret,
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: PRICELIST_AI_PROMPT },
        { role: 'user', content: text },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`AI gateway error: ${response.status}`)
  }

  const data = (await response.json()) as { reply?: string }
  const reply = (data.reply || '').trim()
  if (!reply) {
    throw new Error('Empty AI reply')
  }

  // Убрать markdown code block если есть
  let jsonStr = reply
  const codeMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeMatch) {
    jsonStr = codeMatch[1].trim()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error('AI returned invalid JSON')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not an array')
  }

  const items: ImportItem[] = []
  for (const row of parsed as AIPriceItem[]) {
    const title = row?.title && String(row.title).trim()
    if (!title) continue

    const price =
      row?.price != null && typeof row.price === 'number' && !Number.isNaN(row.price)
        ? row.price
        : null

    items.push({
      title,
      price,
      priceWithVat: price,
      unit: row?.unit && String(row.unit).trim() ? String(row.unit).trim() : undefined,
      sku: undefined,
    })
  }

  return items
}
