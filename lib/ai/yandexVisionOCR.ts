/**
 * Yandex Vision OCR — распознавание текста с изображений заявок.
 * POST https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText
 *
 * Env: YANDEX_API_KEY, YANDEX_FOLDER_ID
 *
 * Модель table возвращает tables[].cells[] с rowIndex/columnIndex — используем для сохранения структуры.
 */

import {
  parseTableRowsByColumnStructure,
  stripBeforeOvochiRows,
  stripBeforeOvochiLines,
  normalizeCell,
} from '@/lib/ocr/orderImage'

const OCR_URL = 'https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText'
const LOG_MAX = 200

/** Заголовки и категории заявки — пропускаем при сборке строк */
const SERVICE_ROW_PATTERNS = [
  /^кухня$/i,
  /^подразделение$/i,
  /^дата\s*заявки$/i,
  /^фамилия\s*заказчика/i,
  /^номенклатура$/i,
  /^количество$/i,
  /^ед\.?\s*изм\.?$/i,
  /^наименование$/i,
  /^(овощи|зелень|фрукты|ягоды|сухофрукты|орехи)(\s*[\/\\|]\s*.*)?$/i,
  /^овощи\s+очищенные$/i,
  /^сухофрукты\/\s*орехи$/i,
]

/** Извлечь строки из tables[].cells[] (model=table).
 * Колонки: 1=номенклатура, 2=игнор, 3=qty+ед.изм. Парсим с колонки 3, затем берём колонку 1.
 * Левая часть таблицы, затем правая (при 6+ колонках). */
export function extractTableRowsFromResponse(data: unknown): string[] | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>

  const result = obj.result as Record<string, unknown> | undefined
  const textAnnotation = (result?.textAnnotation ?? result?.text_annotation ?? result) as Record<string, unknown> | undefined
  const tables = (textAnnotation?.tables ?? (textAnnotation as Record<string, unknown>)?.tables) as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(tables) || tables.length === 0) return null

  const allRowsAsCells: string[][] = []
  for (const table of tables) {
    const cells = table.cells as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(cells) || cells.length === 0) continue

    const byRow = new Map<number, Array<{ col: number; text: string }>>()
    for (const cell of cells) {
      const text = typeof cell.text === 'string' ? cell.text.trim() : ''
      if (!text) continue
      const rowIdx = parseInt(String(cell.rowIndex ?? cell.row_index ?? 0), 10)
      const colIdx = parseInt(String(cell.columnIndex ?? cell.column_index ?? 0), 10)
      if (!byRow.has(rowIdx)) byRow.set(rowIdx, [])
      byRow.get(rowIdx)!.push({ col: colIdx, text })
    }

    const rowIndices = Array.from(byRow.keys()).sort((a, b) => a - b)
    for (const rowIdx of rowIndices) {
      const cellsInRow = byRow.get(rowIdx)!.sort((a, b) => a.col - b.col)
      const normalized = cellsInRow.map((c) => ({ col: c.col, text: normalizeCell(c.text).trim() })).filter((c) => c.text)
      if (normalized.length < 2) continue
      const hasRowNumCol = normalized.length > 1 && /^\d+$/.test(normalized[0].text)
      const rowIndexVal = hasRowNumCol ? normalized[0].text : null
      const dataCells = hasRowNumCol ? normalized.slice(1) : normalized
      // Сохраняем структуру: индекс массива = columnIndex. Колонка C (index 2) — количество.
      const maxCol = Math.max(...dataCells.map((c) => c.col))
      const row: string[] = []
      for (let col = 0; col <= maxCol; col++) {
        const cell = dataCells.find((c) => c.col === col)
        row.push(cell ? cell.text : '')
      }
      const rowWithIndex = rowIndexVal ? [rowIndexVal, ...row] : row
      if (rowWithIndex.filter(Boolean).length < 2) continue
      if (SERVICE_ROW_PATTERNS.some((p) => p.test(rowWithIndex.join(' ')))) continue
      allRowsAsCells.push(rowWithIndex)
    }
  }
  if (allRowsAsCells.length === 0) return null
  const rowsAfterOvochi = stripBeforeOvochiRows(allRowsAsCells)
  const items = parseTableRowsByColumnStructure(rowsAfterOvochi)
  return items.length > 0 ? items : null
}

/** Извлечь текст из ответа Yandex Vision OCR (blocks -> lines -> text). Старт после "ОВОЩИ". */
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
  const linesAfterOvochi = stripBeforeOvochiLines(lines)
  return linesAfterOvochi.join('\n')
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
  const tableRows = extractTableRowsFromResponse(data)
  const text = tableRows
    ? tableRows.join('\n')
    : extractTextFromResponse(data)

  const logPreview = text.slice(0, LOG_MAX) + (text.length > LOG_MAX ? '...' : '')
  console.log('[Yandex Vision OCR]', tableRows ? `table rows=${tableRows.length}` : 'blocks', 'preview:', logPreview)

  return text
}
