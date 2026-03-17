import { sanitizeTitle } from '@/lib/orchestrator/sanitizeTitle'

/**
 * Предобработка текста перед парсингом:
 * - буквы-цифры / буквы–цифры / буквы—цифры → буквы цифры
 * - число+единица (2кг, 5шт, 1л, 3упак) → число единица
 */
export function preprocessForParse(text: string): string {
  let s = (text || '').trim()
  if (!s) return s
  // Между буквами и цифрами: -/–/— → пробел
  s = s.replace(/([a-zA-Zа-яёА-ЯЁ])([\-\u2013\u2014])(\d)/g, '$1 $3')
  s = s.replace(/(\d)([\-\u2013\u2014])([a-zA-Zа-яёА-ЯЁ])/g, '$1 $3')
  // Число слеплено с единицей: 2кг → 2 кг, 500г → 500 г
  s = s.replace(/(\d)(кг|шт|т|л|м|ед|упак|г|гр|мг|мл|уп|упак|пач|пуч|кор|ящ|g)/gi, '$1 $2')
  // Нормализация пробелов: только внутри строк, переносы строк сохраняем
  return s
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim()
}

/** Строка-заголовок (Мк - 2; Войкова 4В, бар) — не парсим как позиции */
function isHeaderLine(line: string): boolean {
  return line.includes(';')
}

/** "в пачках 1шт 125гр" — одна позиция, не резать по второму qty */
const PACK_WEIGHT_IN_LINE = /\d+\s*(?:шт|уп|упак|пач)\s+\d+\s*(?:г|гр)\b/i

function parseLineToRows(
  line: string,
  defaultUnit: string
): { name: string; quantity: string; unit: string }[] {
  const rows: { name: string; quantity: string; unit: string }[] = []
  const re = /([^\d]+?)[\s\-]+(\d+(?:[.,]\d+)?)\s*(кг|г|гр|шт|т|л|м|ед|упак|мл|уп|пач)?/gi
  const onePackItem = PACK_WEIGHT_IN_LINE.test(line)
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    const name = m[1].trim()
    const quantity = m[2].replace(',', '.')
    const unit = ((m[3] || defaultUnit) as string).toLowerCase()
    if (name) rows.push({ name, quantity, unit })
    if (onePackItem) break
  }
  return rows
}

/**
 * Парсинг позиций из description/title заявки MAX.
 * Поддерживает разделители: пробел или дефис (Картофель-5кг, Лук 2кг).
 * Многострочные заявки парсятся построчно; строки-заголовки (с ";") пропускаются.
 */
export function parseMaxRequestToRows(
  title: string,
  description: string
): { name: string; quantity: string; unit: string }[] {
  const text = (description || title || '').trim()
  if (!text) return []
  const cleanTitle = (title || '').replace(/^Заявка из MAX:\s*/i, '').trim()
  let src = description || cleanTitle || text
  src = preprocessForParse(src)
  const rows: { name: string; quantity: string; unit: string }[] = []
  const lines = src.split('\n').filter(Boolean)
  for (const line of lines) {
    if (isHeaderLine(line)) continue
    rows.push(...parseLineToRows(line, 'шт'))
  }
  if (rows.length === 0) rows.push({ name: src.split('\n')[0] || src, quantity: '1', unit: 'шт' })
  return rows
}

/**
 * Парсинг с сохранением отсутствия unit (для Orchestrator).
 * Когда unit не указан в строке — возвращает пустую строку вместо "шт".
 * Многострочные заявки парсятся построчно; строки-заголовки (с ";") пропускаются.
 */
export function parseMaxRequestToRowsWithOptionalUnit(
  title: string,
  description: string
): { name: string; quantity: string; unit: string }[] {
  const text = (description || title || '').trim()
  if (!text) return []
  const cleanTitle = (title || '').replace(/^Заявка из MAX:\s*/i, '').trim()
  let src = description || cleanTitle || text
  src = preprocessForParse(src)
  const rows: { name: string; quantity: string; unit: string }[] = []
  const lines = src.split('\n').filter(Boolean)
  for (const line of lines) {
    if (isHeaderLine(line)) continue
    let m: RegExpExecArray | null
    const re = /([^\d]+?)[\s\-]+(\d+(?:[.,]\d+)?)\s*(кг|г|гр|шт|т|л|м|ед|упак|мл|уп|пач)?/gi
    const onePackItem = PACK_WEIGHT_IN_LINE.test(line)
    while ((m = re.exec(line)) !== null) {
      const name = m[1].trim()
      const quantity = m[2].replace(',', '.')
      const unit = (m[3] ?? '').toString().toLowerCase().trim()
      if (name) rows.push({ name, quantity, unit })
      if (onePackItem) break
    }
  }
  if (rows.length === 0) rows.push({ name: src.split('\n')[0] || src, quantity: '1', unit: '' })
  return rows
}

/** Результат parseSegment (Orchestrator 2.1) */
export interface ParseSegmentResult {
  rawText: string
  name: string
  quantity: string
  unit: string
  hasDashTerminated: boolean
}

/** Единицы граммов: г, гр, g (латиница) */
const GRAM_UNITS = new Set(['г', 'гр', 'g'])

/**
 * Нормализация г/гр/g:
 * - qty < 1: опечатка единицы (0.100гр → 0.1 кг)
 * - qty >= 1000: настоящие граммы → кг
 * - 1 <= qty < 1000: оставить граммы (стандарт: г)
 */
function normalizeGramQty(qty: string, unit: string): { quantity: string; unit: string } {
  const u = (unit || '').toLowerCase().trim()
  if (!GRAM_UNITS.has(u)) {
    return { quantity: qty.replace(',', '.'), unit: u || '' }
  }
  const n = parseFloat(qty.replace(',', '.'))
  if (isNaN(n) || n < 0) {
    return { quantity: qty.replace(',', '.'), unit: 'г' }
  }
  if (n < 1) {
    console.log('[ORCH] g_to_kg reason=G_TO_KG_SMALL_DECIMAL qty=', qty, '→ unit=кг')
    return { quantity: n.toString(), unit: 'кг' }
  }
  if (n >= 1000) {
    return { quantity: (n / 1000).toString(), unit: 'кг' }
  }
  return { quantity: n.toString(), unit: 'г' }
}

/**
 * Парсинг одного сегмента (после segmentNeeds).
 * "Морковь-" -> quantity: "", hasDashTerminated: true.
 * "500г" -> 0.5 кг.
 */
export function parseSegment(segment: string): ParseSegmentResult | null {
  const rawText = segment.trim()
  const src = preprocessForParse(rawText)
  if (!src) return null
  if (/^\d+$/.test(src)) return null
  if (/^\d+(?:[.,]\d+)?\s*(?:кг|г|л|шт|уп|т)/i.test(src) && !/[\p{L}]/u.test(src.replace(/\d/g, '').replace(/\s/g, ''))) return null

  const hasDashTerminated = /[-–—]+$/.test(rawText)

  const re = /([^\d]+?)[\s\-]+(\d+(?:[.,]\d+)?)\s*(кг|шт|т|л|м|ед|упак|г|гр|мг|мл|уп|упак|пач|пуч|кор|ящ|g)?/i
  const m = src.match(re)
  if (m) {
    const name = sanitizeTitle(m[1].trim())
    const { quantity, unit } = normalizeGramQty(m[2], (m[3] ?? '').toString())
    if (name) return { rawText, name, quantity, unit, hasDashTerminated }
  }

  const name = sanitizeTitle(src.replace(/[-–—]+$/, '').trim())
  if (name && /[\p{L}]/u.test(name)) return { rawText, name, quantity: '', unit: '', hasDashTerminated }
  return null
}
