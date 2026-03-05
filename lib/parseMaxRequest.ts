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
  s = s.replace(/(\d)(кг|шт|т|л|м|ед|упак|г|гр|мг|мл|уп|упак|пач|пуч|кор|ящ)/gi, '$1 $2')
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * Парсинг позиций из description/title заявки MAX.
 * Поддерживает разделители: пробел или дефис (Картофель-5кг, Лук 2кг).
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
  const re = /([^\d]+?)[\s\-]+(\d+(?:[.,]\d+)?)\s*(кг|шт|т|л|м|ед|упак)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const name = m[1].trim()
    const quantity = m[2].replace(',', '.')
    const unit = ((m[3] || 'шт') as string).toLowerCase()
    if (name) rows.push({ name, quantity, unit })
  }
  if (rows.length === 0) rows.push({ name: src, quantity: '1', unit: 'шт' })
  return rows
}

/**
 * Парсинг с сохранением отсутствия unit (для Orchestrator).
 * Когда unit не указан в строке — возвращает пустую строку вместо "шт".
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
  const re = /([^\d]+?)[\s\-]+(\d+(?:[.,]\d+)?)\s*(кг|шт|т|л|м|ед|упак)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const name = m[1].trim()
    const quantity = m[2].replace(',', '.')
    const unit = (m[3] ?? '').toString().toLowerCase().trim()
    if (name) rows.push({ name, quantity, unit })
  }
  if (rows.length === 0) rows.push({ name: src, quantity: '1', unit: '' })
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

/**
 * Нормализация 500г → 0.5 кг (граммы в кг).
 */
function normalizeGramQty(qty: string, unit: string): { quantity: string; unit: string } {
  const u = (unit || '').toLowerCase()
  if (u === 'г' || u === 'гр') {
    const n = parseFloat(qty.replace(',', '.'))
    if (!isNaN(n) && n >= 0) {
      return { quantity: (n / 1000).toString(), unit: 'кг' }
    }
  }
  return { quantity: qty.replace(',', '.'), unit: u || '' }
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

  const re = /([^\d]+?)[\s\-]+(\d+(?:[.,]\d+)?)\s*(кг|шт|т|л|м|ед|упак|г|гр|мг|мл|уп|упак|пач|пуч|кор|ящ)?/i
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
