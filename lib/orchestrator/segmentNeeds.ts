/**
 * segmentNeeds — первый шаг pipeline.
 * Сегментация raw-текста на независимые сегменты позиций.
 * Строки не склеиваются. Packed-line разбивается по qty.
 */

const QTY_PATTERN = /\d+(?:[.,]\d+)?/g
const UNIT_AFTER_QTY = /\s*(?:кг|кг\.|kg|г|гр|г\.|мг|л|л\.|ml|мл|шт|pcs|уп|уп\.|упак|пач|пуч|кор|ящ|т)?/i

/** Нормализация: \r\n, ;, запятая (не между цифрами) → \n; разбить на строки, trim, схлопнуть пробелы */
function normalizeAndSplit(text: string): string[] {
  let s = (text || '').replace(/\r\n/g, '\n').replace(/;/g, '\n').trim()
  s = s.replace(/(?<!\d),(?!\d)/g, '\n')
  return s
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Конец qty+unit от позиции qty */
function getQtyUnitEnd(line: string, qtyStart: number): number {
  const qtyM = line.slice(qtyStart).match(/^(\d+(?:[.,]\d+)?)\s*((?:кг|кг\.|kg|г|гр|г\.|мг|л|л\.|ml|мл|шт|pcs|уп|уп\.|упак|пач|пуч|кор|ящ|т))?/i)
  if (!qtyM) return qtyStart + 1
  return qtyStart + qtyM[0].length
}

/** Все qty с флагом isTypo (вторая из двух подряд — опечатка) */
function findAllQty(line: string): { index: number; end: number; isTypo: boolean }[] {
  const result: { index: number; end: number; isTypo: boolean }[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(QTY_PATTERN.source, 'g')
  while ((m = re.exec(line)) !== null) {
    const idx = m.index
    const end = getQtyUnitEnd(line, idx)
    const prev = result[result.length - 1]
    const between = prev ? line.slice(prev.end, idx) : ''
    const onlySpacesAndUnit = /^[\s]*(?:кг|кг\.|kg|г|гр|л|мл|шт|уп|т)?[\s]*$/i.test(between)
    const isTypo = !!prev && onlySpacesAndUnit && (idx - prev.end) < 12
    result.push({ index: idx, end, isTypo })
  }
  return result
}

/** Разбить "морковь- чеснок 0,500" на ["морковь-", "чеснок 0,500"] */
function splitDashTerminated(segment: string): string[] {
  const m = segment.match(/^(.+[-–—])\s+(.+)$/)
  if (!m) return [segment]
  const before = m[1].trim()
  const after = m[2].trim()
  if (!/\d/.test(after)) return [segment]
  const word = before.replace(/[-–—]+$/, '').trim()
  if (!word) return [segment]
  return [before, after]
}

/** "1 кг картофель" -> "картофель 1 кг" */
function reorderStartsWithQty(segment: string): string {
  const m = segment.trim().match(/^(\d+(?:[.,]\d+)?)\s*((?:кг|кг\.|kg|г|гр|мг|л|мл|шт|pcs|уп|упак|пач|пуч|кор|ящ|т)\s*)?(.+)$/i)
  if (!m) return segment
  const [, qty, unit = '', title] = m
  return `${title.trim()} ${qty}${unit ? ` ${unit.trim()}` : ''}`.trim()
}

/** Отбросить сегмент без title */
function isValidSegment(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  if (/^\d+$/.test(t)) return false
  if (/^\d+(?:[.,]\d+)?\s*(?:кг|г|л|шт|уп|т)/i.test(t) && !/[\p{L}]/u.test(t.replace(/\d/g, '').replace(/\s/g, ''))) return false
  return true
}

/** Сегментировать одну строку */
function segmentLine(line: string): string[] {
  const trimmed = line.trim()
  if (!trimmed) return []

  const allQty = findAllQty(trimmed)
  const validQty = allQty.filter((q) => !q.isTypo)

  if (allQty.length === 0) {
    return isValidSegment(trimmed) ? [trimmed] : []
  }

  if (allQty.length === 1 && validQty.length === 1) {
    let seg = trimmed
    const expanded = splitDashTerminated(seg)
    return expanded.map((s) => reorderStartsWithQty(s.trim())).filter(isValidSegment)
  }

  if (validQty.length === 0) return []

  const segments: string[] = []
  for (let i = 0; i < validQty.length; i++) {
    const start = i === 0 ? 0 : validQty[i - 1].end
    const end = validQty[i].end
    let seg = trimmed.slice(start, end).trim()
    const nextStart = i + 1 < validQty.length ? validQty[i + 1].index : trimmed.length
    const tail = trimmed.slice(end, nextStart).trim()
    if (tail && !/\d+(?:[.,]\d+)?/.test(tail)) seg = seg + ' ' + tail
    seg = reorderStartsWithQty(seg)
    const expanded = splitDashTerminated(seg)
    segments.push(...expanded.map((s) => s.trim()).filter(isValidSegment))
  }

  const lastEnd = validQty[validQty.length - 1].end
  let remainder = trimmed.slice(lastEnd).trim()
  if (remainder && /[\p{L}]/u.test(remainder)) {
    const typoQty = allQty.find((q) => q.isTypo && q.index >= lastEnd)
    if (typoQty) {
      const typoInRem = trimmed.slice(typoQty.index, typoQty.end)
      remainder = remainder.replace(typoInRem, '').replace(/\s+/g, ' ').trim()
    }
    if (remainder) {
      const expanded = splitDashTerminated(reorderStartsWithQty(remainder))
      segments.push(...expanded.map((s) => s.trim()).filter(isValidSegment))
    }
  }

  return segments
}

const MAX_MESSAGE_LENGTH = 2000
const MAX_SEGMENTS = 50

/**
 * segmentNeeds(text) — первый шаг pipeline.
 * Лимиты: 2000 символов, 50 сегментов.
 */
export function segmentNeeds(text: string): string[] {
  const raw = (text || '').slice(0, MAX_MESSAGE_LENGTH)
  const lines = normalizeAndSplit(raw)
  const all: string[] = []
  for (const line of lines) {
    if (all.length >= MAX_SEGMENTS) break
    all.push(...segmentLine(line))
  }
  return all.slice(0, MAX_SEGMENTS).filter(Boolean)
}
