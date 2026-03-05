/**
 * Orchestrator 2.1 — извлечение признаков для Decision Engine.
 */

const LEGAL_PATTERN = /(?:^|[\s,.-])(ооо|ип|зао|оао|пао|ao|llc)(?:[\s,.-]|$)/i
const ADDRESS_PATTERN = /(?:^|[\s,.-])(навагинская|войково|моремолл|ул\.?|дом|д\.|адрес|офис|кв)(?:[\s,.-]|$)/i
const OUTLET_PATTERN = /(?:^|[\s,.-])(кухня|бар|кафе|ресторан|склад|точка|филиал|кофейня)(?:[\s,.-]|$)/i

export interface SegmentFeatures {
  hasQty: boolean
  hasUnit: boolean
  wordCount: number
  matchType: 'alias' | 'learned' | 'token' | 'none'
  matchScore: number
  hasLegalForm: boolean
  hasAddressWord: boolean
  hasOutletWord: boolean
  hasDashTerminated: boolean
  startsWithQty: boolean
  qtyLooksLikeAddressNumber: boolean
  qtyLooksLikeQuantity: boolean
}

function countWords(text: string): number {
  const normalized = (text || '').trim().toLowerCase().replace(/\s+/g, ' ')
  const words = normalized.split(/\s+/).filter((w) => w && !/^\d+(?:[.,]\d+)?$/.test(w))
  return words.length
}

/**
 * qty >= 7 и целое → похоже на номер дома (навагинская 7).
 */
function qtyLooksLikeAddressNumber(qty: string): boolean {
  if (!qty) return false
  const n = parseFloat(qty.replace(',', '.'))
  if (isNaN(n) || n < 7) return false
  return Number.isInteger(n)
}

/**
 * qty в диапазоне 0.1–5 или дробное → похоже на количество.
 */
function qtyLooksLikeQuantity(qty: string): boolean {
  if (!qty) return false
  const n = parseFloat(qty.replace(',', '.'))
  if (isNaN(n)) return false
  if (n >= 0.1 && n <= 5) return true
  return /[.,]/.test(qty)
}

export function extractFeatures(
  segment: { rawText?: string; name: string; quantity: string; unit: string; hasDashTerminated?: boolean },
  resolved: { matchType?: 'alias' | 'learned' | 'token' | 'none'; matchScore?: number }
): SegmentFeatures {
  const line = (segment.rawText ?? segment.name) || ''
  const lineLower = line.trim().toLowerCase()
  const qty = segment.quantity || ''
  const unit = segment.unit || ''

  const wordCount = countWords(line)

  return {
    hasQty: qty.length > 0,
    hasUnit: unit.length > 0,
    wordCount,
    matchType: resolved.matchType ?? 'none',
    matchScore: resolved.matchScore ?? 0,
    hasLegalForm: LEGAL_PATTERN.test(lineLower),
    hasAddressWord: ADDRESS_PATTERN.test(lineLower),
    hasOutletWord: OUTLET_PATTERN.test(lineLower),
    hasDashTerminated: !!segment.hasDashTerminated,
    startsWithQty: /^\d+(?:[.,]\d+)?/.test(line.trim()),
    qtyLooksLikeAddressNumber: qtyLooksLikeAddressNumber(qty),
    qtyLooksLikeQuantity: qtyLooksLikeQuantity(qty),
  }
}
