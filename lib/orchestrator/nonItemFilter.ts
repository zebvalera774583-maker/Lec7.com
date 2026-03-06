/**
 * Фильтр non-item строк: заголовки, компания, адреса → comments.
 * Строки с низким score и признаками не-номенклатуры не попадают в items.
 * Защита: не придумывать товары из мусорных/неполных сегментов.
 */

const COMPANY_PATTERN = /(?:^|[\s,.-])(ооо|ип|зао|оао|пао|ao|llc)(?:[\s,.-]|$)/i

/** Единицы измерения в начале строки — обрывок (кг 7, л 2) */
const UNIT_FIRST = /^(кг|г|гр|л|мл|шт|уп|упак|т)\s+\d/i

/** Мусор: начинается с : или , — обрывок количества */
const GARBAGE_PREFIX = /^[:\s,]/

/** Адрес/подразделение: слово + число + буква (Войкова 4В, корпус 2А) */
const ADDRESS_LIKE = /^[а-яёa-z]+\s+\d+[а-яёa-z]$/i

/** Короткий заголовок: Мк -, 2 шт - и т.п. */
const SHORT_HEADER = /^[а-яёa-z]{1,3}\s*[-–—]\s*$/i

/**
 * Сегмент — мусор или обрывок: нельзя превращать в товар.
 * Примеры: Мк -, Войкова 4В, бар, кг 7, ,2 0, :10, :1
 */
export function isGarbageSegment(
  segment: string,
  parsed: { name: string; quantity: string; unit: string }
): boolean {
  const s = (segment || '').trim()
  const name = (parsed?.name || '').trim()
  if (!s) return true

  if (GARBAGE_PREFIX.test(s)) return true
  if (UNIT_FIRST.test(s)) return true
  if (ADDRESS_LIKE.test(s)) return true
  if (SHORT_HEADER.test(s)) return true

  if (s.length <= 4 && !/\d/.test(s)) return true

  const commaNum = /^,\d|\d,\d*$/
  if (commaNum.test(s) || /^[,\d\s]+$/.test(s)) return true

  return false
}

/** Единицы — не названия товаров */
const UNIT_ONLY = new Set(['кг', 'г', 'гр', 'л', 'мл', 'шт', 'уп', 'упак', 'пач', 'пуч', 'кор', 'ящ', 'т', 'бар'])

/** Извлечь значимые слова (≥3 букв, не единицы) */
function getSignificantWords(text: string): string[] {
  const s = (text || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\s]/gu, ' ')
  return s.split(/\s+/).filter((w) => w.length >= 3 && !UNIT_ONLY.has(w))
}

/**
 * Сегмент сомнительный: нельзя уверенно прочитать товар из исходного текста.
 * Не создавать item, если нет внятного названия И количества, или canonicalName далёк от segment.
 */
export function isDoubtfulSegment(
  segment: string,
  parsed: { name: string; quantity: string; unit: string },
  resolved: { canonicalName: string; matchType?: string },
  opts?: { hasDashTerminated?: boolean }
): boolean {
  const s = (segment || '').trim()
  const name = (parsed?.name || '').trim()
  const qty = (parsed?.quantity || '').trim()
  const canonical = (resolved?.canonicalName || '').trim()

  if (!s || !name) return true

  if (s.length < 5) return true

  const nameWords = getSignificantWords(name)
  if (nameWords.length === 0) return true

  if (UNIT_ONLY.has(name.toLowerCase())) return true

  if (!opts?.hasDashTerminated) {
    if (!qty || qty === '0') return true
    const n = parseFloat(qty.replace(',', '.'))
    if (isNaN(n) || n <= 0 || n > 10000) return true
  }

  if (resolved?.matchType === 'token' && canonical) {
    const canonicalWords = getSignificantWords(canonical)
    const segmentWords = getSignificantWords(s)
    const hasOverlap =
      canonicalWords.some((cw) => segmentWords.some((sw) => sw.includes(cw) || cw.includes(sw))) ||
      nameWords.some((nw) => canonicalWords.some((cw) => cw.includes(nw) || nw.includes(cw)))
    if (!hasOverlap) return true
  }

  return false
}

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
