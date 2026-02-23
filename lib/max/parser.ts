/**
 * Rules-first parser for line items from text.
 * Units: kg, g, l, ml, pcs, pack (and Russian variants + abbreviations)
 * Supports: "яблоки 10 к", "яблоки 10к", "яблоки 10 кг", "10кг", "10 шт", "10шт"
 */

export interface ParsedLineItem {
  title: string
  qty: string
  unit?: string
}

// Normalize: input -> canonical unit (kg, g, l, ml, pcs, pack)
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

// Unit pattern: longest first for correct matching (кг before к, штук before ш)
const UNIT_PATTERN =
  '(кг|kg|к|g|г|гр|л|l|литр|мл|ml|шт|штук|ш|pcs|уп|упак|пач|pack)?'

// Pattern: name + number + optional unit (with or without space: 10кг, 10 кг, 10 к)
const LINE_ITEM_REGEX = new RegExp(
  `([^\\d]+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*${UNIT_PATTERN}`,
  'gi'
)

export function parseLineItemsFromText(text: string): ParsedLineItem[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const items: ParsedLineItem[] = []
  let m: RegExpExecArray | null

  while ((m = LINE_ITEM_REGEX.exec(trimmed)) !== null) {
    const title = m[1].trim()
    const qty = m[2].replace(',', '.')
    const unitRaw = m[3]?.toLowerCase().trim()
    const unit = unitRaw ? (UNIT_MAP[unitRaw] ?? unitRaw) : undefined

    if (title.length > 0) {
      items.push({ title, qty, unit })
    }
  }

  return items
}

export function normalizeUnitInput(input: string): string | null {
  const lower = input.trim().toLowerCase()
  if (UNIT_MAP[lower]) return UNIT_MAP[lower]
  return null
}
