/**
 * Rules-first parser for line items from text.
 * Parses line-by-line (split by \n, comma, semicolon).
 * Units: kg, g, l, ml, pcs, pack + Russian variants + abbreviations (к, ш, уп, etc.)
 */

export interface ParsedLineItem {
  title: string
  qty: string
  unit?: string
}

const UNIT_MAP: Record<string, string> = {
  к: 'kg',
  кг: 'kg',
  kg: 'kg',
  g: 'g',
  г: 'g',
  гр: 'g',
  l: 'l',
  л: 'l',
  литр: 'l',
  мл: 'ml',
  ml: 'ml',
  шт: 'pcs',
  ш: 'pcs',
  штук: 'pcs',
  pcs: 'pcs',
  уп: 'pack',
  упак: 'pack',
  пач: 'pack',
  pack: 'pack',
}

// Unit pattern: longest first (кг before к, штук before ш)
const UNIT_PATTERN = '(кг|kg|к|g|г|гр|л|l|литр|мл|ml|шт|штук|ш|pcs|уп|упак|пач|pack)?'

// Per-line: title (non-digits) + number + optional unit (with or without space)
const LINE_REGEX = new RegExp(
  `^([^\\d]+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*${UNIT_PATTERN}\\s*$`,
  'i'
)

function parseSingleLine(line: string): ParsedLineItem | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const m = trimmed.match(LINE_REGEX)
  if (!m) return null

  const title = m[1].replace(/\s+/g, ' ').trim()
  if (!title) return null

  const qty = m[2].replace(',', '.')
  const unitRaw = m[3]?.toLowerCase().trim()
  const unit = unitRaw ? (UNIT_MAP[unitRaw] ?? unitRaw) : undefined

  return { title, qty, unit }
}

export function parseLineItemsFromText(text: string): ParsedLineItem[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const lines = normalized
    .split(/[\n,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const items: ParsedLineItem[] = []
  for (const line of lines) {
    const item = parseSingleLine(line)
    if (item && item.title && !item.title.includes('\n')) {
      items.push(item)
    }
  }
  return items
}

export function normalizeUnitInput(input: string): string | null {
  const lower = input.trim().toLowerCase()
  if (UNIT_MAP[lower]) return UNIT_MAP[lower]
  return null
}
