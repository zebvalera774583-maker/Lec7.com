/**
 * Фильтр non-item строк: заголовки, компания, адреса → comments.
 * Строки с низким score и признаками не-номенклатуры не попадают в items.
 */

const COMPANY_PATTERN = /(?:^|[\s,.-])(ооо|ип|зао|оао|пао|ao|llc)(?:[\s,.-]|$)/i
const SERVICE_PATTERN = /(?:^|[\s,.-])(ул\.?|дом|д\.|адрес|кухня|бар|кафе|ресторан|склад|точка|филиал|поставка|срочно|кофейня)(?:[\s,.-]|$)/i
const ADDRESS_WORDS = new Set([
  'навагинская', 'войково', 'моремолл', 'ул', 'дом', 'д', 'адрес', 'офис', 'кв',
])

/**
 * Проверка: строка похожа на заголовок/компанию/адрес, а не на номенклатуру.
 * Rules: B (company), C (service), D (address pattern + low score).
 * Rule A: matchScore >= 0.6 → item (return false)
 */
export function isLikelyNonItem(
  line: string,
  matchScore: number,
  parsed: { name: string; quantity: string; unit: string }
): { isNonItem: boolean; reason?: string } {
  const lineLower = (line || '').trim().toLowerCase()
  const words = lineLower.split(/\s+/).filter(Boolean)

  // Rule A: высокий score → item
  if (matchScore >= 0.6) {
    return { isNonItem: false }
  }

  // Rule B: юр. формы
  if (COMPANY_PATTERN.test(lineLower)) {
    return { isNonItem: true, reason: 'company' }
  }

  // Rule D: адресный паттерн (слово + число как адрес) при низком score — до C, т.к. адрес более специфичен
  if (matchScore < 0.2 && words.length >= 2) {
    for (let i = 0; i < words.length - 1; i++) {
      const w = words[i].replace(/[^a-zа-яё]/gi, '')
      const next = words[i + 1]
      if (ADDRESS_WORDS.has(w) && /^\d+$/.test(next)) {
        return { isNonItem: true, reason: 'address' }
      }
    }
    if (/навагинская\s+\d|войково\s+\d|ул\.?\s*\d|д\.\s*\d/i.test(lineLower)) {
      return { isNonItem: true, reason: 'address' }
    }
  }

  // Rule C: служебные слова (кухня, бар, кафе в контексте заголовка)
  if (SERVICE_PATTERN.test(lineLower)) {
    return { isNonItem: true, reason: 'service' }
  }

  // Rule E: очень длинная строка с низким score
  if (matchScore < 0.3 && words.length > 6) {
    return { isNonItem: true, reason: 'long_low_score' }
  }

  return { isNonItem: false }
}
