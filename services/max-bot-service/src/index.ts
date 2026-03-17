import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import express from 'express'
import axios from 'axios'
import sharp from 'sharp'
import { Bot } from '@maxhub/max-bot-api'

const PORT = 3005
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN
const LEC7_BASE_URL = (process.env.LEC7_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const LEC7_MAX_SECRET = process.env.LEC7_MAX_SECRET || ''

if (!MAX_BOT_TOKEN) {
  console.error('MAX_BOT_TOKEN is required')
  process.exit(1)
}

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`max-bot-service listening on port ${PORT}`)
})

const bot = new Bot(MAX_BOT_TOKEN)

/** Безопасное извлечение ключей для debug-лога (без бинарных данных) */
function safeKeys(obj: unknown): string[] {
  if (obj == null || typeof obj !== 'object') return []
  return Object.keys(obj as object)
}

/** Компактный summary для message.link (объект или массив) */
function linkSummary(link: unknown): Record<string, unknown> | null {
  if (link == null) return null
  if (Array.isArray(link)) {
    const first = link[0]
    return {
      type: 'array',
      length: link.length,
      firstElementKeys: first != null && typeof first === 'object' ? safeKeys(first) : [],
    }
  }
  if (typeof link === 'object') {
    const payload = (link as any)?.payload
    const att = (link as any)?.attachments
    return {
      type: 'object',
      linkKeys: safeKeys(link),
      hasType: 'type' in (link as object),
      hasUrl: 'url' in (link as object) || !!(payload?.url ?? (link as any)?.url),
      hasFile: 'file' in (link as object) || !!(payload?.file ?? (link as any)?.file ?? payload?.file_id),
      hasPayload: !!payload,
      payloadKeys: payload ? safeKeys(payload) : [],
      hasAttachments: !!att,
      attachmentsLength: Array.isArray(att) ? att.length : 0,
    }
  }
  return { type: typeof link }
}

/** Debug: сырой update для диагностики изображений */
function logRawUpdate(ctx: any, eventType: string) {
  const u = ctx?.update ?? ctx
  const msg = ctx?.message ?? u?.message
  const body = msg?.body ?? {}
  const attachments = body?.attachments ?? []
  const attPayloads = attachments.map((a: any) => ({
    type: a?.type,
    payloadKeys: a?.payload ? safeKeys(a.payload) : [],
    hasUrl: !!(a?.payload?.url ?? a?.payload?.link),
    hasFile: !!(a?.payload?.file ?? a?.payload?.file_id ?? a?.payload?.id),
  }))
  const link = msg?.link
  const linkSum = linkSummary(link)
  const linkMsg = link?.message
  const linkMsgBody = linkMsg?.body
  const linkMsgAttachments = linkMsgBody?.attachments ?? []
  const linkMsgAttPayloads = linkMsgAttachments.map((a: any) => ({
    type: a?.type,
    payloadKeys: a?.payload ? safeKeys(a.payload) : [],
    hasUrl: !!(a?.payload?.url ?? a?.payload?.link),
    hasFile: !!(a?.payload?.file ?? a?.payload?.file_id ?? a?.payload?.id),
  }))

  const out: Record<string, unknown> = {
    eventType,
    updateKeys: safeKeys(u),
    messageKeys: msg ? safeKeys(msg) : [],
    bodyKeys: safeKeys(body),
    bodyText: typeof body?.text === 'string' ? body.text.slice(0, 80) : body?.text,
    attachmentCount: attachments?.length ?? 0,
    attachmentTypes: attachments?.map((a: any) => a?.type) ?? [],
    attachmentPayloads: attPayloads,
    chatId: ctx?.chatId ?? ctx?.chat?.chat_id ?? msg?.recipient?.chat_id,
    userId: ctx?.user?.user_id ?? msg?.sender?.user_id,
    linkKeys: link != null && typeof link === 'object' && !Array.isArray(link) ? safeKeys(link) : undefined,
    linkSummary: linkSum ?? undefined,
  }
  if (linkMsg != null && typeof linkMsg === 'object') {
    out.linkMessageKeys = safeKeys(linkMsg)
    if (linkMsgBody != null) {
      out.linkMessageBodyKeys = safeKeys(linkMsgBody)
      out.linkMessageBodyText = typeof linkMsgBody?.text === 'string' ? linkMsgBody.text.slice(0, 80) : linkMsgBody?.text
      out.linkMessageAttachmentCount = linkMsgAttachments.length
      out.linkMessageAttachmentTypes = linkMsgAttachments.map((a: any) => a?.type)
      out.linkMessageAttachmentPayloads = linkMsgAttPayloads
    }
  }
  console.log('[MAX raw update]', out)
}

const YANDEX_OCR_URL = 'https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText'

/** Заголовки и категории заявки — пропускаем при сборке строк из таблицы */
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

/** Заголовок "ОВОЩИ" (не "Овощи очищенные"). Считывание начинается после этой строки. */
const START_AFTER_HEADER = /^овощи\s*$/i

function stripBeforeOvochiRows(rows: string[][]): string[][] {
  const idx = rows.findIndex((row) => row.some((cell) => START_AFTER_HEADER.test(cell.trim())))
  if (idx === -1) return rows
  const sliced = rows.slice(idx + 1)
  console.log('[MAX OCR] start after ОВОЩИ, dropped', idx + 1, 'rows, remaining', sliced.length)
  return sliced
}

function stripBeforeOvochiLines(lines: string[]): string[] {
  const idx = lines.findIndex((line) => START_AFTER_HEADER.test(line.trim()))
  if (idx === -1) return lines
  const sliced = lines.slice(idx + 1)
  console.log('[MAX OCR] start after ОВОЩИ (blocks), dropped', idx + 1, 'lines, remaining', sliced.length)
  return sliced
}

/** Нормализация строк таблицы */
function normalizeTableRowText(row: string): string {
  return row
    .replace(/(\d+(?:[.,]\d+)?)\s*к\b/gi, '$1 кг')
    .replace(/(\d)(кг|г|гр|шт|л|мл|уп)\b/gi, '$1 $2')
    .replace(/\bКГ\.?\s*(\d)/gi, '$1 кг')
    .replace(/\bЗ\s*(\d)/g, '3 $1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Только qty+unit (1 кг, 0.5 кг). НЕ "Перец 1 кг". */
const QTY_UNIT_ONLY = /^\s*(\d+(?:[.,]\d+)?)\s*(кг|г|гр|л|мл|шт|уп|упак|пач|пуч|кор|ящ|т|м|ед)?\s*$/i

function isNameOnly(s: string): boolean {
  const t = s.trim()
  return t.length >= 2 && /[\p{L}]/u.test(t) && !/\d/.test(t)
}

const UNIT_ONLY_ROW = /^(кг|г|гр|л|мл|шт|уп|упак|пач|пуч|кор|ящ|т|м|ед|к)$/i

/** Не склеивать "Вешенки" + "1 кг" когда после "1 кг" идёт "Перец болгарский". Зато "1 кг" + "Перец" → "Перец 1 кг". */
function postProcessTableRows(rows: string[]): string[] {
  const normalized = rows.map(normalizeTableRowText).filter(Boolean)
  const result: string[] = []
  for (let i = 0; i < normalized.length; i++) {
    const row = normalized[i]
    const next = normalized[i + 1]
    const nextNext = normalized[i + 2]
    const rowIsNameOnly = isNameOnly(row)
    const rowIsQtyOnly = row && QTY_UNIT_ONLY.test(row.trim())
    const nextIsQtyOnly = next && QTY_UNIT_ONLY.test(next.trim())
    const nextIsUnitOnly = next && UNIT_ONLY_ROW.test(next.trim())
    const nextIsNameOnly = next && isNameOnly(next)
    const nextNextIsProduct = nextNext && (isNameOnly(nextNext) || /^[\p{L}]/u.test(nextNext.trim()))
    if (rowIsNameOnly && nextIsQtyOnly && !nextNextIsProduct) {
      result.push(`${row} ${next}`.trim())
      i++
      continue
    }
    if (rowIsNameOnly && nextIsUnitOnly && nextNext && QTY_UNIT_ONLY.test(nextNext.trim())) {
      result.push(`${row} ${nextNext}`.trim())
      i += 2
      continue
    }
    if (rowIsQtyOnly && nextIsNameOnly) {
      result.push(`${next} ${row}`.trim())
      i++
      continue
    }
    result.push(row)
  }
  return result
}

/** Парсинг qty+unit из ячейки (10кг, 2 кг, 0.200). Без единицы: 0.xxx → г, целое → шт. */
function parseQtyUnitCell(cell: string): { qty: string; unit: string } | null {
  const normalized = cell.replace(/(\d)\s*к\b/gi, '$1 кг').replace(/\bЗ\s*(\d)/g, '3 $1')
  const m = normalized.match(/^(\d+(?:[.,]\d+)?)\s*(кг|г|гр|л|мл|шт|уп|упак|пач|пуч|кор|ящ|т|м|ед)?$/i)
  if (!m) return null
  const qty = m[1].replace(',', '.')
  const n = parseFloat(qty)
  const defaultUnit = n > 0 && n < 1 ? 'г' : 'шт'
  return { qty, unit: (m[2] || defaultUnit).toLowerCase() }
}

/** Строка содержит число + единицу или только число в конце (0.200 без г) */
const HAS_QTY_UNIT_FALLBACK = /\d+(?:[.,]\d+)?\s*(кг|г|гр|л|мл|шт|уп|упак|пач|пуч|кор|ящ|т|м|ед|pcs)|\d+(?:[.,]\d+)?\s*$/i

const QTY_UNIT_REGEX = /(\d+(?:[.,]\d+)?)\s*(кг|г|гр|л|мл|шт|уп|упак|пач|пуч|кор|ящ|т|м|ед|pcs)/gi

/** Число в конце строки без единицы (Лук зелёный 0.200) */
const QTY_ONLY_AT_END = /(\d+(?:[.,]\d+)?)\s*$/

function inferUnitFromQty(qty: string): string {
  const n = parseFloat(qty.replace(',', '.'))
  return n > 0 && n < 1 ? 'г' : 'шт'
}

/** Извлечь name, qty, unit из строки. Поддержка числа без единицы: 0.xxx → г, целое → шт. */
function parseQtyUnitFromText(fullRow: string): { name: string; qty: string; unit: string } | null {
  const normalized = fullRow.replace(/(\d)\s*к\b/gi, '$1 кг').replace(/\bЗ\s*(\d)/g, '3 $1')
  const matches = [...normalized.matchAll(QTY_UNIT_REGEX)]
  if (matches.length === 0) {
    const m = normalized.match(QTY_ONLY_AT_END)
    if (!m) return null
    const qty = m[1].replace(',', '.').trim()
    const unit = inferUnitFromQty(qty)
    let name = normalized.slice(0, m.index).trim()
    name = name.replace(/\s+(кг|г|гр|шт)\s*$/i, '').trim()
    if (!name || name.length < 2 || !/[\p{L}]/u.test(name)) return null
    if (/^[\d\s]+$/.test(name)) return null
    if (SERVICE_ROW_PATTERNS.some((p) => p.test(name))) return null
    if (/\s+(г|кг|шт)\s+\S/.test(name)) return null
    return { name, qty, unit }
  }
  let best = matches[0]
  if (matches.length > 1) {
    const decimalGram = matches.find((m) => /^\d+[.,]\d+$/.test(m[1]) && /^(г|гр)$/i.test(m[2] || ''))
    if (decimalGram) best = decimalGram
    else if (/в пачках|в упак|пачк/i.test(normalized)) {
      const firstSh = matches.find((m) => /^(шт|уп|упак|пач)$/i.test(m[2] || ''))
      if (firstSh) best = firstSh
      else best = matches[matches.length - 1]
    } else {
      best = matches[matches.length - 1]
    }
  }
  const qty = best[1].replace(',', '.').trim()
  if (!qty) return null
  const unit = (best[2] || 'шт').toLowerCase().replace('pcs', 'шт')
  let name = normalized.slice(0, best.index).trim()
  name = name.replace(/\s+(кг|г|гр|шт)\s*$/i, '').trim()
  if (!name || name.length < 2 || !/[\p{L}]/u.test(name)) return null
  if (/^[\d\s]+$/.test(name)) return null
  if (SERVICE_ROW_PATTERNS.some((p) => p.test(name))) return null
  if (/\s+(г|кг|шт)\s+\S/.test(name)) return null
  return { name, qty, unit }
}

/** Склеить разорванные строки: ["лук"] + ["репчатый", "2кг"] или ["репчатый", "кг", "2кг"] → одна строка */
function mergeSplitNameRows(rows: string[][]): string[][] {
  const result: string[][] = []
  let i = 0
  while (i < rows.length) {
    const curr = rows[i]
    const next = rows[i + 1]
    if (curr.length === 1 && next && (next.length === 2 || next.length === 3)) {
      const c0 = curr[0].trim()
      const n0 = next[0].trim()
      const qtyCell = next.length === 2 ? next[1].trim() : next[2]?.trim() ?? ''
      if (c0.length >= 2 && c0.length <= 25 && /[\p{L}]/u.test(c0) && !/^\d+$/.test(c0) &&
          n0.length >= 2 && /[\p{L}]/u.test(n0) && !parseQtyUnitCell(n0) &&
          parseQtyUnitCell(qtyCell)) {
        const mergedName = c0 + ' ' + n0
        const mergedRow = next.length === 2 ? [mergedName, qtyCell] : [mergedName, next[1].trim(), qtyCell]
        result.push(mergedRow)
        console.log('[PARSE MERGE ROWS]', JSON.stringify(curr), '+', JSON.stringify(next), '->', mergedRow)
        i += 2
        continue
      }
    }
    result.push(curr)
    i++
  }
  return result
}

/** Парсинг по колонкам: col0=номенклатура, col1=игнор, col2=qty+ед. Сначала col2, потом col0. Левая часть, затем правая (6+ колонок). */
function parseTableRowsByColumnStructure(rows: string[][]): string[] {
  rows = mergeSplitNameRows(rows)
  const items: string[] = []
  const skipped: { row: string; reason: string }[] = []
  const processSection = (cells: string[]) => {
    const fullRow = cells.join(' ').trim()

    if (cells.length < 3) {
      if (cells.length === 2) {
        const c0 = cells[0].trim()
        const c1 = cells[1].trim().replace(/\.$/, '')
        if (/^(кг|г|гр|л|мл|шт|уп|упак|пач|пуч|кор|ящ|т|м|ед|к)$/i.test(c1)) {
          const qtyInName = parseQtyUnitFromText(c0)
          if (qtyInName && !/в пачках|в упак|пачк/i.test(c0) && !c0.match(/\d+\s*(?:шт|уп|пач)\s+\d+\s*(?:г|гр)\b/i)) {
            items.push(`${qtyInName.name} ${qtyInName.qty} ${qtyInName.unit}`.trim())
            console.log('[PARSE 2 CELLS]', fullRow, '-> qty from name')
            return
          }
        }
      }
      skipped.push({ row: fullRow, reason: 'cells<3' })
      return
    }
    const col0 = cells[0].trim()
    const col1 = cells[1]?.trim() ?? ''
    const col2 = cells[2].trim()
    const rowStr = `${col0} | ${col2}`
    if (SERVICE_ROW_PATTERNS.some((p) => p.test(col0))) {
      skipped.push({ row: rowStr, reason: 'service_pattern' })
      return
    }
    const col3 = cells[3]?.trim() ?? ''
    let qtyIdx = -1
    let parsed: { qty: string; unit: string } | null = null
    for (let i = 1; i < cells.length; i++) {
      parsed = parseQtyUnitCell(cells[i].trim())
      if (parsed) {
        qtyIdx = i
        break
      }
    }
    const nameParts: string[] = []
    for (let i = 0; i < (qtyIdx >= 0 ? qtyIdx : cells.length); i++) {
      const c = cells[i].trim()
      if (!c) continue
      if (parseQtyUnitCell(c)) break
      if (/^(кг|г|гр|л|мл|шт|уп|упак|пач|пуч|кор|ящ|т|м|ед|к)$/i.test(c.replace(/\.$/, ''))) break
      if (/^\d+(?:[.,]\d+)?\s*$/.test(c)) break
      if (SERVICE_ROW_PATTERNS.some((p) => p.test(c))) break
      if (/^[\p{L}\s\-()]+$/u.test(c) && c.length < 50 && !/^\d+$/.test(c)) {
        nameParts.push(c)
      } else {
        break
      }
    }
    let name = nameParts.join(' ').trim()
    if (qtyIdx > 0 && parsed && /^\d+(?:[.,]\d+)?\s*$/.test(cells[qtyIdx].trim())) {
      const prevCell = cells[qtyIdx - 1]?.trim().replace(/\.$/, '')
      if (prevCell && /^(кг|г|гр|л|мл|шт|уп|упак|пач|пуч|кор|ящ|т|м|ед|к)$/i.test(prevCell)) {
        parsed = { ...parsed, unit: prevCell.toLowerCase() }
      }
    }

    const tryRepairFromFragments = (): boolean => {
      if (!/^\d+$/.test(col0)) return false
      const col1 = cells[1]?.trim() ?? ''
      if (!col1 || !/[\p{L}]/u.test(col1) || col1.length < 2) return false
      if (SERVICE_ROW_PATTERNS.some((p) => p.test(col1))) return false
      const qtyFromCol2 = parseQtyUnitCell(col2)
      if (!qtyFromCol2 || !qtyFromCol2.qty) return false
      const qtyNum = parseFloat(qtyFromCol2.qty)
      const unit = qtyFromCol2.unit || (qtyNum > 0 && qtyNum < 1 ? 'г' : 'шт')
      items.push(`${col1} ${qtyFromCol2.qty} ${unit}`.trim())
      console.log('[PARSE REPAIR TABLE_ROW]', `source=${rowStr}`, `repaired=${col1} ${qtyFromCol2.qty} ${unit}`)
      return true
    }

    if (!parsed) {
      if (tryRepairFromFragments()) return
      const qtyInName = parseQtyUnitFromText(col0)
      if (qtyInName && !/в пачках|в упак|пачк/i.test(col0) && !col0.match(/\d+\s*(?:шт|уп|пач)\s+\d+\s*(?:г|гр)\b/i)) {
        items.push(`${qtyInName.name} ${qtyInName.qty} ${qtyInName.unit}`.trim())
        console.log('[PARSE OCR MERGE]', rowStr, '-> qty from name cell')
        return
      }
      skipped.push({ row: rowStr, reason: 'qty_column_empty' })
      return
    }
    if (!name || /^\d+$/.test(name)) {
      if (tryRepairFromFragments()) return
      skipped.push({ row: rowStr, reason: 'name_empty_or_digits' })
      return
    }
    if (!looksLikeProductName(name)) {
      if (tryRepairFromFragments()) return
      skipped.push({ row: rowStr, reason: 'not_product_name' })
      return
    }
    items.push(`${name} ${parsed.qty} ${parsed.unit}`.trim())
  }
  for (const row of rows) {
    if (row.length < 2) continue
    const skipFirst = row.length >= 4 && /^\d+$/.test(row[0].trim())
    const cells = skipFirst ? row.slice(1) : row
    processSection(cells)
    if (cells.length >= 4) processSection(cells.slice(3))
  }
  if (skipped.length > 0) {
    console.log('[PARSE SKIPPED] table_cols', skipped.map((s) => `${s.reason}: ${s.row.slice(0, 50)}`))
  }
  if (items.length > 0) {
    console.log('[PARSE ITEMS]', items.join(' | '))
  }
  return items
}

/** Извлечь строки из tables[].cells[]. Колонки: 1=номенклатура, 2=игнор, 3=qty+ед. Сначала col3, потом col1. Левая часть, затем правая. */
function extractTableRowsFromYandexResponse(data: unknown): string[] | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>
  const result = obj.result as Record<string, unknown> | undefined
  const textAnnotation = (result?.textAnnotation ?? result) as Record<string, unknown> | undefined
  const tables = textAnnotation?.tables as Array<Record<string, unknown>> | undefined
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
      console.log(`[OCR RAW CELL] row=${rowIdx} col=${colIdx} text=${text}`)
      if (!byRow.has(rowIdx)) byRow.set(rowIdx, [])
      byRow.get(rowIdx)!.push({ col: colIdx, text })
    }

    const rowIndices = Array.from(byRow.keys()).sort((a, b) => a - b)
    for (const rowIdx of rowIndices) {
      const cellsInRow = byRow.get(rowIdx)!.sort((a, b) => a.col - b.col)
      const texts = cellsInRow.map((c) => c.text)
      if (texts.length < 2) {
        console.log('[OCR ROW SKIPPED cells<2] row=', rowIdx, 'cells=', texts.length, 'texts=', JSON.stringify(texts))
        continue
      }
      if (texts.length === 2) {
        console.log('[OCR ROW 2 cells] row=', rowIdx, 'texts=', JSON.stringify(texts))
      }
      if (texts.some((t) => /шампиньон/i.test(t))) {
        console.log('[OCR ROW Шампиньоны] row=', rowIdx, 'texts=', JSON.stringify(texts))
      }
      if (SERVICE_ROW_PATTERNS.some((p) => p.test(texts.join(' ')))) continue
      allRowsAsCells.push(texts)
    }
  }
  if (allRowsAsCells.length === 0) return null
  const rowsAfterOvochi = stripBeforeOvochiRows(allRowsAsCells)
  const items = parseTableRowsByColumnStructure(rowsAfterOvochi)
  return items.length > 0 ? items : null
}

function extractLinesFromYandexResponse(data: unknown): string[] {
  if (!data || typeof data !== 'object') return []
  const obj = data as Record<string, unknown>
  const root = (obj.result ?? obj.textAnnotation ?? obj) as Record<string, unknown> | undefined
  if (!root) return []
  const textAnnotation = root.textAnnotation as Record<string, unknown> | undefined
  if (textAnnotation && typeof textAnnotation.text === 'string' && textAnnotation.text.trim()) {
    return textAnnotation.text.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  }
  const directText = root.text
  if (typeof directText === 'string' && directText.trim()) {
    return directText.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  }
  const blocks = (root.blocks ?? textAnnotation?.blocks) as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(blocks)) return []
  const lines: string[] = []
  for (const block of blocks) {
    const blockLines = block.lines as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(blockLines)) continue
    for (const line of blockLines) {
      const text = line.text
      if (typeof text === 'string' && text.trim()) lines.push(text.trim())
    }
  }
  return lines
}

function extractTextFromYandexResponse(data: unknown): string {
  const lines = extractLinesFromYandexResponse(data)
  return lines.join('\n')
}

/** Мусорные строки: номера строк (12., 57..., 67...), разделители */
const GARBAGE_LINE = /^\d+$|^\d+\.?\.\.?$|^[|:()]$|^\.+$|^.$/
/** Служебные и категории — пропускаем */
const SERVICE_LINE =
  /^(подразделение|дата\s*заявки|мк2\s*кухня|кухня|наименование|номенклатура|количество|ед\.?\s*изм\.?)$/i
const CATEGORY_LINE = /^(овощи|зелень|фрукты|ягоды|сухофрукты|орехи)(\s*[\/\\|]\s*.*)?$/i

/** Строка содержит только единицу измерения */
const UNIT_ONLY = /^(кг|г|гр|л|мл|шт|уп|упак|пач|пуч|кор|ящ|т|м|ед|к)$/i

/** Строка содержит qty+unit (1.5кг, 10 шт) */
const HAS_QTY_UNIT = /\d+(?:[.,]\d+)?\s*(кг|г|гр|л|мл|шт|уп|упак|пач|пуч|кор|ящ|т|м|ед)?$/i

/** Похожа на название товара: буквы, не только цифры/символы */
function looksLikeProductName(s: string): boolean {
  const t = s.trim()
  if (!t || t.length < 2) return false
  if (GARBAGE_LINE.test(t)) return false
  if (UNIT_ONLY.test(t)) return false
  return /[\p{L}]/u.test(t) && !/^\d+$/.test(t)
}

/** Реконструкция OCR-строк: фильтр мусора + объединение unit-строк с названием */
function reconstructOcrLines(lines: string[]): string[] {
  const filtered: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (GARBAGE_LINE.test(t)) continue
    if (SERVICE_LINE.test(t)) continue
    if (CATEGORY_LINE.test(t)) continue
    if (/^подразделение\s|^дата\s*заявки\s|мк2\s*кухня/i.test(t) && t.length < 50) continue
    filtered.push(t)
  }

  const result: string[] = []
  for (let i = 0; i < filtered.length; i++) {
    const line = filtered[i]
    const isUnitOnly = UNIT_ONLY.test(line)
    const hasQtyUnit = HAS_QTY_UNIT.test(line)
    const nextLine = filtered[i + 1]
    const nextHasQtyUnit = nextLine ? HAS_QTY_UNIT.test(nextLine) : false

    if (isUnitOnly && nextHasQtyUnit) {
      continue
    }
    if (isUnitOnly || hasQtyUnit) {
      const prev = result[result.length - 1]
      if (prev && looksLikeProductName(prev)) {
        result[result.length - 1] = `${prev} ${line}`.trim()
        continue
      }
    }
    result.push(line)
  }
  return result
}

const VALID_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp']

function parseMimeFromContentType(contentType: string | undefined): string {
  if (!contentType || typeof contentType !== 'string') return 'image/jpeg'
  const mime = contentType.split(';')[0].trim().toLowerCase()
  return VALID_IMAGE_MIMES.includes(mime) ? mime : 'image/jpeg'
}

/** OCR: Yandex Vision OCR (same as Lec7). Env: YANDEX_API_KEY, YANDEX_FOLDER_ID */
async function recognizeImageWithYandex(
  buffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<{ text: string; lines: string[]; fromTable?: boolean }> {
  const apiKey = process.env.YANDEX_API_KEY?.trim()
  const folderId = process.env.YANDEX_FOLDER_ID?.trim()
  if (!apiKey || !folderId) {
    throw new Error('YANDEX_API_KEY and YANDEX_FOLDER_ID are required for Yandex Vision OCR')
  }
  const content = buffer.toString('base64')
  const res = await axios.post(
    YANDEX_OCR_URL,
    { mimeType, languageCodes: ['ru'], model: 'table', content },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Api-Key ${apiKey}`,
        'x-folder-id': folderId,
      },
      timeout: 30000,
    }
  )
  const tableRows = extractTableRowsFromYandexResponse(res.data)
  let lines: string[]
  let fromTable = false
  if (tableRows && tableRows.length > 0) {
    lines = tableRows
    fromTable = true
    console.log('[MAX OCR] table rows=', tableRows.length, 'items=', tableRows.join(' | '))
  } else {
    console.log('[MAX OCR] table empty, using blocks fallback')
    const blockLines = extractLinesFromYandexResponse(res.data)
    const linesAfterOvochi = stripBeforeOvochiLines(blockLines)
    linesAfterOvochi.forEach((line, idx) => console.log(`[OCR RAW LINE] idx=${idx} text=${line}`))
    lines = reconstructOcrLines(linesAfterOvochi)
    lines = postProcessTableRows(lines)
    lines = lines.filter(
      (l) =>
        !SERVICE_ROW_PATTERNS.some((p) => p.test(l)) &&
        !CATEGORY_LINE.test(l) &&
        !/подразделение.*дата\s*заявки|дата\s*заявки.*подразделение/i.test(l)
    )
  }
  const text = lines.join('\n')
  if (!text) {
    console.log('[MAX OCR RAW]', JSON.stringify(res.data).slice(0, 4000))
  }
  return { text, lines, fromTable }
}

/** Левая колонка таблицы (~40% ширины) — отдельный OCR для проверки гипотезы потери названий */
const LEFT_COLUMN_WIDTH_RATIO = 0.4

async function recognizeLeftColumnWithYandex(
  buffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  const apiKey = process.env.YANDEX_API_KEY?.trim()
  const folderId = process.env.YANDEX_FOLDER_ID?.trim()
  if (!apiKey || !folderId) return ''

  const meta = await sharp(buffer).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  if (w < 50 || h < 50) return ''

  const leftW = Math.max(50, Math.floor(w * LEFT_COLUMN_WIDTH_RATIO))
  const leftBuffer = await sharp(buffer)
    .extract({ left: 0, top: 0, width: leftW, height: h })
    .jpeg({ quality: 90 })
    .toBuffer()

  const outDir = path.join(process.cwd(), 'ocr-debug')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `left-column-${Date.now()}.jpg`)
  fs.writeFileSync(outPath, leftBuffer)
  console.log('[OCR LEFT COLUMN IMAGE]', path.resolve(outPath))

  const content = leftBuffer.toString('base64')
  const res = await axios.post(
    YANDEX_OCR_URL,
    { mimeType: 'image/jpeg', languageCodes: ['ru'], model: 'page', content },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Api-Key ${apiKey}`,
        'x-folder-id': folderId,
      },
      timeout: 30000,
    }
  )
  return extractTextFromYandexResponse(res.data)
}

type WebhookResponse = {
  replyText?: string
  replyInlineKeyboard?: {
    buttons?: { text: string; callback_data: string }[]
    rows?: { text: string; callback_data: string }[][]
  }
}

async function forwardToWebhook(
  chatId: string | number,
  userId: string | number | undefined,
  text: string,
  choice?: string,
  messageId?: string,
  ts?: string,
  source?: 'ocr' | 'max_photo' | 'max_pdf',
  rawText?: string,
  lines?: string[]
) {
  const payload: Record<string, unknown> = { chatId, userId, text, messageId, ts, choice }
  if (source) payload.source = source
  if (rawText != null) payload.rawText = rawText
  if (lines != null) payload.lines = lines
  const timeoutMs = source === 'ocr' || source === 'max_photo' || source === 'max_pdf' ? 60000 : 15000
  const { data } = await axios.post<WebhookResponse>(
    `${LEC7_BASE_URL}/api/integrations/max/webhook`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'X-LEC7-MAX-SECRET': LEC7_MAX_SECRET,
      },
      timeout: timeoutMs,
    }
  )
  return data
}

// MAX API format: attachments with type inline_keyboard, payload.buttons (not reply_markup)
function sendReply(ctx: any, replyText: string, replyInlineKeyboard?: WebhookResponse['replyInlineKeyboard']) {
  if (replyInlineKeyboard?.rows?.length) {
    const buttons = replyInlineKeyboard.rows.map((row) =>
      row.map((btn) => ({ type: 'callback' as const, text: btn.text, payload: btn.callback_data }))
    )
    return ctx.reply(replyText, {
      attachments: [{ type: 'inline_keyboard', payload: { buttons } }],
    })
  }
  if (replyInlineKeyboard?.buttons?.length) {
    const buttons = [
      replyInlineKeyboard.buttons.map((btn) => ({
        type: 'callback' as const,
        text: btn.text,
        payload: btn.callback_data,
      })),
    ]
    return ctx.reply(replyText, {
      attachments: [{ type: 'inline_keyboard', payload: { buttons } }],
    })
  }
  return ctx.reply(replyText)
}

bot.on('message_callback', async (ctx: any) => {
  const payload = ctx.update?.callback?.payload ?? ctx.callbackQuery?.data
  const chatId = ctx.chatId ?? ctx.chat?.chat_id ?? ctx.message?.recipient?.chat_id
  const userId = ctx.user?.user_id ?? ctx.update?.callback?.user?.user_id

  if (!payload || !chatId) return

  console.log('[MAX callback]', { chatId, userId, choice: payload })

  try {
    const data = await forwardToWebhook(
      String(chatId),
      userId != null ? String(userId) : undefined,
      '',
      payload,
      undefined,
      undefined
    )
    const replyText = data?.replyText ?? 'Спасибо, заявка принята'
    try {
      await ctx.answerOnCallback?.({ notification: replyText })
    } catch (e) {
      console.warn('[MAX] answerOnCallback error:', e)
    }
    await sendReply(ctx, replyText, data?.replyInlineKeyboard)
    console.log('[MAX outgoing]', { chatId, replyText: replyText.slice(0, 50) })
  } catch (err: any) {
    const msg = err?.response?.data?.error ?? err?.message ?? 'Ошибка'
    console.error('[MAX error]', msg)
    await ctx.reply('Произошла ошибка. Попробуйте позже.')
  }
})

bot.on('message_created', async (ctx: any) => {
  logRawUpdate(ctx, 'message_created')

  const body = ctx.message?.body
  const text = body?.text
  const bodyAttachments = body?.attachments as {
    type?: string
    payload?: { url?: string; link?: string; mimeType?: string; fileName?: string; name?: string; filename?: string }
  }[] | undefined
  const linkMsgAttachments = ctx.message?.link?.message?.attachments as
    | {
        type?: string
        payload?: { url?: string; link?: string; mimeType?: string; fileName?: string; name?: string; filename?: string }
      }[]
    | undefined

  const chatId = ctx.chatId ?? ctx.chat?.chat_id ?? ctx.message?.recipient?.chat_id
  const userId = ctx.user?.user_id ?? ctx.message?.sender?.user_id
  const messageId = ctx.messageId ?? ctx.message?.body?.mid
  const ts = ctx.message?.created_at ?? new Date().toISOString()

  let messageText = typeof text === 'string' ? text : ''
  let useOcrSource = false
  let attachmentSource: 'body.attachments' | 'link.message.attachments' | undefined

  // [MAX attachment] логирование
  const allAttachments = [...(bodyAttachments ?? []), ...(linkMsgAttachments ?? [])]
  if (allAttachments.length > 0) {
    console.log('[MAX attachment]', {
      count: allAttachments.length,
      types: allAttachments.map((a) => a?.type),
      payloads: allAttachments.map((a) => ({
        keys: a?.payload ? Object.keys(a.payload) : [],
        mimeType: (a?.payload as any)?.mimeType,
        fileName: (a?.payload as any)?.fileName ?? (a?.payload as any)?.name ?? (a?.payload as any)?.filename,
        hasUrl: !!(a?.payload?.url ?? (a?.payload as any)?.link),
      })),
    })
  }

  // Детект PDF: type=file/document и (mimeType=application/pdf или имя заканчивается на .pdf)
  function isPdfAttachment(a: { type?: string; payload?: { mimeType?: string; fileName?: string; name?: string; filename?: string } }): boolean {
    if (!a?.payload) return false
    const t = (a.type || '').toLowerCase()
    if (t !== 'file' && t !== 'document') return false
    const p = a.payload as any
    const mime = (p?.mimeType || '').toLowerCase()
    if (mime.includes('pdf')) return true
    const name = (p?.fileName ?? p?.name ?? p?.filename ?? '').toLowerCase()
    if (name.endsWith('.pdf')) return true
    return false
  }

  let pdfAtt: { type?: string; payload?: { url?: string; link?: string } } | undefined
  if (Array.isArray(bodyAttachments) && bodyAttachments.length > 0) {
    pdfAtt = bodyAttachments.find(isPdfAttachment)
    if (pdfAtt) attachmentSource = 'body.attachments'
  }
  if (!pdfAtt && Array.isArray(linkMsgAttachments) && linkMsgAttachments.length > 0) {
    pdfAtt = linkMsgAttachments.find(isPdfAttachment)
    if (pdfAtt) attachmentSource = 'link.message.attachments'
  }

  // Обработка PDF — скачивание, парсинг через Lec7, webhook
  if (!messageText.trim() && pdfAtt) {
    const url = pdfAtt?.payload?.url ?? pdfAtt?.payload?.link
    if (url) {
      try {
        console.log('[MAX PDF] detected')
        console.log('[MAX PDF] download start')
        const pdfRes = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 })
        const pdfBuffer = Buffer.from(pdfRes.data)
        console.log('[MAX PDF] download success bytes=', pdfBuffer.length)

        const pdfBase64 = pdfBuffer.toString('base64')
        const parseRes = await axios.post<{ text?: string; itemsCount?: number; error?: string }>(
          `${LEC7_BASE_URL}/api/integrations/max/parse-pdf`,
          { pdfBase64 },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-LEC7-MAX-SECRET': LEC7_MAX_SECRET,
            },
            timeout: 60000,
          }
        )
        const orderText = parseRes.data?.text ?? ''
        const itemsCount = parseRes.data?.itemsCount ?? 0
        console.log('[MAX PDF] parsed items count=', itemsCount)

        if (!orderText.trim()) {
          await sendReply(ctx, 'Не удалось извлечь текст заявки из PDF. Попробуйте отправить фото или текстом.')
          return
        }

        const data = await forwardToWebhook(
          chatId,
          userId,
          orderText,
          undefined,
          messageId,
          ts,
          'max_pdf'
        )
        const replyText = data?.replyText ?? 'Спасибо, заявка принята'
        await sendReply(ctx, replyText, data?.replyInlineKeyboard)
        console.log('[MAX PDF] done', { replyText: replyText.slice(0, 50) })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.log('[MAX PDF] download fail:', msg)
        await sendReply(ctx, 'Не удалось обработать PDF. Попробуйте отправить фото или текстом.')
      }
      return
    }
  }

  // Поиск image: primary = body.attachments, fallback = link.message.attachments
  let imageAtt: { type?: string; payload?: { url?: string; link?: string } } | undefined
  if (Array.isArray(bodyAttachments) && bodyAttachments.length > 0) {
    imageAtt = bodyAttachments.find((a) => a?.type === 'image')
    if (imageAtt) attachmentSource = 'body.attachments'
  }
  if (!imageAtt && Array.isArray(linkMsgAttachments) && linkMsgAttachments.length > 0) {
    imageAtt = linkMsgAttachments.find((a) => a?.type === 'image')
    if (imageAtt) attachmentSource = 'link.message.attachments'
  }

  // Обработка изображений (attachments) — OCR. MAX может присылать PDF как type=image (превью).
  // Проверяем Content-Type: если application/pdf — идём в PDF-ветку, не OCR.
  if (!messageText.trim() && imageAtt) {
    const url = imageAtt?.payload?.url ?? imageAtt?.payload?.link
    if (url) {
      let textForBot: string
      let rawText = ''
      let reconstructedLines: string[] = []
      try {
        console.log('[MAX PHOTO] received')
        const imgRes = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 })
        let buffer = Buffer.from(imgRes.data)
        let mimeType = parseMimeFromContentType(imgRes.headers['content-type'])
        console.log('[MAX PHOTO] downloaded bytes=', buffer.length, 'mime=', mimeType)

        // MAX иногда присылает PDF как image — по факту это PDF
        if (mimeType === 'application/pdf') {
          console.log('[MAX PDF] detected (Content-Type from image attachment)')
          try {
            const pdfBase64 = buffer.toString('base64')
            const parseRes = await axios.post<{ text?: string; itemsCount?: number }>(
              `${LEC7_BASE_URL}/api/integrations/max/parse-pdf`,
              { pdfBase64 },
              {
                headers: { 'Content-Type': 'application/json', 'X-LEC7-MAX-SECRET': LEC7_MAX_SECRET },
                timeout: 60000,
              }
            )
            const orderText = parseRes.data?.text ?? ''
            console.log('[MAX PDF] parsed items count=', parseRes.data?.itemsCount ?? 0)
            if (orderText.trim()) {
              const data = await forwardToWebhook(chatId, userId, orderText, undefined, messageId, ts, 'max_pdf')
              await sendReply(ctx, data?.replyText ?? 'Спасибо, заявка принята', data?.replyInlineKeyboard)
              return
            }
          } catch (e) {
            console.log('[MAX PDF] parse fail:', e instanceof Error ? e.message : String(e))
          }
          await sendReply(ctx, 'Не удалось извлечь текст заявки из PDF. Попробуйте отправить фото или текстом.')
          return
        }

        if (mimeType === 'image/webp') {
          buffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer()
          mimeType = 'image/jpeg'
          console.log('[MAX PHOTO] converted webp -> jpeg bytes=', buffer.length)
        }

        const { text: ocrText, lines: ocrLines, fromTable } = await recognizeImageWithYandex(buffer, mimeType)
        console.log('[MAX OCR TEXT]\n', ocrText)

        try {
          const leftColumnText = await recognizeLeftColumnWithYandex(buffer, mimeType)
          console.log('[OCR LEFT COLUMN]', leftColumnText || '(empty)')
        } catch (e) {
          console.log('[OCR LEFT COLUMN] error:', e instanceof Error ? e.message : String(e))
        }

        if (!ocrText.trim()) {
          await sendReply(ctx, 'Не удалось распознать заявку, попробуйте отправить фото лучше или текстом.')
          return
        }

        reconstructedLines = fromTable ? ocrLines : reconstructOcrLines(ocrLines)
        rawText = ocrText
        textForBot = reconstructedLines.join('\n')
        messageText = textForBot
        useOcrSource = true

        console.log('[MAX PHOTO] reconstructed lines=', reconstructedLines)
        console.log('[MAX PHOTO] textForBot=\n', textForBot)
        console.log('[MAX -> handleBotEvent] chatId=', chatId, 'userId=', userId, 'text=', textForBot, 'source=max_photo')
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.log('[OCR] fail:', msg)
        await sendReply(ctx, 'Не удалось распознать заявку, попробуйте отправить фото лучше или текстом.')
        return
      }

      try {
        const data = await forwardToWebhook(
          chatId,
          userId,
          textForBot,
          undefined,
          messageId,
          ts,
          'max_photo',
          rawText,
          reconstructedLines
        )

        console.log('[handleBotEvent -> MAX]', JSON.stringify(data))

        const replyText = data?.replyText ?? 'Спасибо, заявка принята'
        console.log('[MAX final reply]', replyText)
        await sendReply(ctx, replyText, data?.replyInlineKeyboard)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.log('[MAX OCR -> webhook] fail:', msg)
        await sendReply(ctx, 'Не удалось распознать заявку, попробуйте отправить фото лучше или текстом.')
      }
      return
    }
  }

  if (attachmentSource) {
    console.log('[MAX image attachment]', { attachmentSource })
  }

  if (!messageText.trim()) return

  console.log('[MAX -> handleBotEvent] chatId=', chatId, 'userId=', userId, 'text=', messageText, 'ocr=', useOcrSource)

  try {
    const data = await forwardToWebhook(
      chatId,
      userId,
      messageText,
      undefined,
      messageId,
      ts,
      useOcrSource ? 'ocr' : undefined
    )

    console.log('[handleBotEvent -> MAX]', JSON.stringify(data))

    const replyText = data?.replyText ?? 'Спасибо, заявка принята'
    console.log('[MAX final reply]', replyText)
    await sendReply(ctx, replyText, data?.replyInlineKeyboard)
    console.log('[MAX outgoing]', { chatId, replyText: replyText.slice(0, 50) })
  } catch (err: any) {
    const msg = err?.response?.data?.error ?? err?.message ?? 'Ошибка'
    console.error('[MAX error]', msg)
    await ctx.reply('Произошла ошибка. Попробуйте позже.')
  }
})

bot.catch((err) => {
  console.error('[MAX bot error]', err)
  process.exit(1)
})

bot.on('message_constructed', (ctx: any) => {
  logRawUpdate(ctx, 'message_constructed')
})

bot.on('message_construction_request', (ctx: any) => {
  logRawUpdate(ctx, 'message_construction_request')
})

bot.start()
