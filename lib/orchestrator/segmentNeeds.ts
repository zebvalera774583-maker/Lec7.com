/**
 * segmentNeeds — первый шаг pipeline.
 * Сегментация raw-текста на независимые сегменты позиций.
 * Строки не склеиваются. Packed-line разбивается по qty.
 */

const UNIT_ONLY_LINE = /^\s*(кг|г|гр|л|мл|шт|уп|упак|пач|пуч|кор|ящ|т)\s*$/i
const ENDS_WITH_NUMBER = /\d(?:[.,]\d+)?\s*$/

/** Склеить перенос единицы: "Мята - 0,2\nкг" → "Мята - 0,2 кг" */
function glueUnitLineBreaks(text: string): string {
  const lines = (text || '').split(/\r?\n/)
  const result: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (UNIT_ONLY_LINE.test(trimmed) && result.length > 0) {
      const prev = result[result.length - 1]
      if (ENDS_WITH_NUMBER.test(prev)) {
        result[result.length - 1] = (prev.trimEnd() + ' ' + trimmed).trim()
        continue
      }
    }
    result.push(line)
  }
  return result.join('\n')
}

const QTY_PATTERN = /\d+(?:[.,]\d+)?/g
const UNIT_AFTER_QTY = /\s*(?:кг|кг\.|kg|г|гр|г\.|мг|л|л\.|ml|мл|шт|pcs|уп|уп\.|упак|пач|пуч|кор|ящ|т)?/i

/** Паттерн: запятая (не после цифры!) + пробелы + qty + unit. Не ломать "0,500" (десятичный разделитель). */
const COMMA_QTY_UNIT = /(?<!\d),\s*(\d+(?:[.,]\d+)?)\s*((?:кг|г|гр|мг|л|мл|шт|уп|упак|пач|пуч|кор|ящ|т|kg|g|l|ml|pcs))?/gi

/** Нормализация: \r\n, ;, запятая (не между цифрами, не перед qty+unit) → \n; разбить на строки */
function normalizeAndSplit(text: string): string[] {
  let s = (text || '').replace(/\r\n/g, '\n').replace(/;/g, '\n').trim()
  // Запятая перед "qty unit" — не разделитель: "Шампиньоны, 1 кг" → один сегмент
  s = s.replace(COMMA_QTY_UNIT, (_, qty, unit) => (unit ? ` ${qty} ${unit.trim()}` : ` ${qty}`))
  s = s.replace(/(?<!\d),(?!\d)/g, '\n')
  return s
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Конец qty+unit от позиции qty. Важно: гр перед г (иначе "125гр" → "125г" + "р") */
function getQtyUnitEnd(line: string, qtyStart: number): number {
  const qtyM = line.slice(qtyStart).match(/^(\d+(?:[.,]\d+)?)\s*((?:кг|кг\.|kg|гр|г\.|г|мг|л|л\.|ml|мл|шт|pcs|уп|уп\.|упак|пач|пуч|кор|ящ|т))?/i)
  if (!qtyM) return qtyStart + 1
  return qtyStart + qtyM[0].length
}

/** Паттерн: "в пачках 1шт 125гр" — второе qty (125гр) это вес пачки, не отдельная позиция */
const PACK_WEIGHT_PATTERN = /\d+\s*(?:шт|уп|упак|пач)\s+\d+\s*(?:г|гр)\b/i

/** Все qty с флагом isTypo (вторая из двух подряд — опечатка или вес пачки) */
function findAllQty(line: string): { index: number; end: number; isTypo: boolean }[] {
  const result: { index: number; end: number; isTypo: boolean }[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(QTY_PATTERN.source, 'g')
  const hasPackWeight = PACK_WEIGHT_PATTERN.test(line)
  while ((m = re.exec(line)) !== null) {
    const idx = m.index
    const end = getQtyUnitEnd(line, idx)
    const prev = result[result.length - 1]
    const between = prev ? line.slice(prev.end, idx) : ''
    const onlySpacesAndUnit = /^[\s]*(?:кг|кг\.|kg|г|гр|л|мл|шт|уп|т)?[\s]*$/i.test(between)
    const isTypo =
      !!prev &&
      (hasPackWeight || (onlySpacesAndUnit && (idx - prev.end) < 12))
    result.push({ index: idx, end, isTypo })
  }
  return result
}

/** Паттерн: qty + optional unit — остаток одной позиции, не резать */
const QTY_UNIT_REST = /^\d+(?:[.,]\d+)?\s*(?:кг|кг\.|kg|г|гр|мг|л|мл|шт|pcs|уп|упак|пач|пуч|кор|ящ|т)?\s*$/i

/** Разбить "морковь- чеснок 0,500" на ["морковь-", "чеснок 0,500"]. Не резать "Мята - 0,2 кг" (after = qty+unit). */
function splitDashTerminated(segment: string): string[] {
  const m = segment.match(/^(.+[-–—])\s+(.+)$/)
  if (!m) return [segment]
  const before = m[1].trim()
  const after = m[2].trim()
  if (!/\d/.test(after)) return [segment]
  if (QTY_UNIT_REST.test(after)) return [segment]
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

/** Строка — один товар: название + дефис/пробелы + qty + unit. Unit опционален. */
const SINGLE_PRODUCT_LINE =
  /^[^\d]+\s*[-–—]?\s*\d+(?:[.,]\d+)?\s*(?:кг|кг\.|kg|г|гр|мг|л|мл|шт|pcs|уп|упак|пач|пуч|кор|ящ|т)?\s*$/i

/** Обрывок qty+unit — не заголовок (к 4, г 500) */
const QTY_UNIT_FRAGMENT_LINE = /^(?:[а-яёa-z]{1,3}\s+)?\d+(?:[.,]\d+)?(?:\s*[а-яёa-z]{1,3})?$|^\d+(?:[.,]\d+)?\s*[а-яёa-z]{1,3}$/i

/** Заголовок/адрес: короткая строка без валидной единицы в конце */
function isHeaderLikeLine(line: string): boolean {
  if (QTY_UNIT_FRAGMENT_LINE.test(line.trim())) return false
  const hasValidUnit = /\s*(?:кг|кг\.|kg|г|гр|мг|л|мл|шт|pcs|уп|упак|пач|пуч|кор|ящ|т)\s*$/i.test(line)
  if (hasValidUnit) return false
  if (/[-–—]\s*$/.test(line)) return false
  if (line.length <= 12 && !/\d/.test(line)) return true
  if (line.length <= 15 && /\d[^\d\s,.]$/.test(line)) return true
  if (line.length < 10 && /\d\s*$/.test(line)) return true
  return false
}

/** Сегментировать одну строку */
function segmentLine(line: string): string[] {
  const trimmed = line.trim()
  if (!trimmed) return []
  if (isHeaderLikeLine(trimmed)) return []

  if (SINGLE_PRODUCT_LINE.test(trimmed) && isValidSegment(trimmed)) {
    return [reorderStartsWithQty(trimmed)]
  }

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
  if (remainder && /[\p{L}]/u.test(remainder) && !PACK_WEIGHT_PATTERN.test(trimmed)) {
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


/** Нормализовать обрывок: "к 4" → "4 кг", "г 500" → "500 г" */
function normalizeQtyUnitFragment(frag: string): string {
  const s = (frag || '').trim()
  const qtyM = s.match(/(\d+(?:[.,]\d+)?)/)
  if (!qtyM) return s
  const qty = qtyM[1]
  const rest = s.replace(qtyM[0], '').replace(/\s+/g, ' ').trim()
  const unitMap: Record<string, string> = { к: 'кг', г: 'г', гр: 'гр', л: 'л', мл: 'мл', шт: 'шт', уп: 'уп' }
  const unit = unitMap[rest.toLowerCase()] || (rest.length <= 2 ? 'кг' : rest)
  return `${qty} ${unit}`.trim()
}

/** Post-merge: склеить "title-" + "qty/unit fragment" */
function mergeDashFragments(segments: string[]): string[] {
  const result: string[] = []
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const prev = result[result.length - 1]
    if (prev && /[-–—]\s*$/.test(prev) && QTY_UNIT_FRAGMENT_LINE.test(seg.trim()) && seg.trim().length <= 12) {
      result[result.length - 1] = (prev.trimEnd() + ' ' + normalizeQtyUnitFragment(seg)).trim()
    } else {
      result.push(seg)
    }
  }
  return result
}

/**
 * segmentNeeds(text) — первый шаг pipeline.
 * Лимиты: 2000 символов, 50 сегментов.
 */
export function segmentNeeds(text: string): string[] {
  const raw = (text || '').slice(0, MAX_MESSAGE_LENGTH)
  const glued = glueUnitLineBreaks(raw)
  const lines = normalizeAndSplit(glued)
  const all: string[] = []
  for (const line of lines) {
    if (all.length >= MAX_SEGMENTS) break
    all.push(...segmentLine(line))
  }
  return mergeDashFragments(all.slice(0, MAX_SEGMENTS).filter(Boolean))
}
