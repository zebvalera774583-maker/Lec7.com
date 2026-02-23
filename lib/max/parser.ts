/**
 * Rules-first parser for line items from text.
 * Units: kg, g, l, ml, pcs, pack (and Russian: кг, г, л, мл, шт, уп)
 */

export interface ParsedLineItem {
  title: string
  qty: string
  unit?: string
}

const UNIT_ALIASES: Record<string, string> = {
  kg: 'kg',
  кг: 'kg',
  g: 'g',
  г: 'g',
  l: 'l',
  л: 'l',
  ml: 'ml',
  мл: 'ml',
  pcs: 'pcs',
  шт: 'pcs',
  штук: 'pcs',
  pack: 'pack',
  уп: 'pack',
  упак: 'pack',
}

const UNIT_REGEX = new RegExp(
  `\\b(${Object.keys(UNIT_ALIASES).join('|')})\\b`,
  'gi'
)

// Pattern: "название число [unit]" or "название число"
// Supports: "яблоки 10 кг", "картофель 5", "молоко 2 л"
const LINE_ITEM_REGEX = /([^\d]+?)\s+(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|pcs|pack|кг|г|л|мл|шт|штук|уп|упак)?/gi

export function parseLineItemsFromText(text: string): ParsedLineItem[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const items: ParsedLineItem[] = []
  let m: RegExpExecArray | null

  while ((m = LINE_ITEM_REGEX.exec(trimmed)) !== null) {
    const title = m[1].trim()
    const qty = m[2].replace(',', '.')
    const unitRaw = m[3]?.toLowerCase()
    const unit = unitRaw ? (UNIT_ALIASES[unitRaw] ?? unitRaw) : undefined

    if (title.length > 0) {
      items.push({ title, qty, unit })
    }
  }

  return items
}

export function normalizeUnitInput(input: string): string | null {
  const lower = input.trim().toLowerCase()
  if (UNIT_ALIASES[lower]) return UNIT_ALIASES[lower]
  if (['кг', 'kg'].includes(lower)) return 'kg'
  if (['шт', 'штук', 'pcs'].includes(lower)) return 'pcs'
  if (['уп', 'упак', 'pack'].includes(lower)) return 'pack'
  if (['л', 'l'].includes(lower)) return 'l'
  if (['г', 'g'].includes(lower)) return 'g'
  if (['мл', 'ml'].includes(lower)) return 'ml'
  return null
}
