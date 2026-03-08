/**
 * Парсит цену из строки/числа.
 * - Убирает пробелы (1 030 → 1030)
 * - Убирает точки как разделители тысяч (1.030 → 1030)
 * - Заменяет запятую на точку как десятичный разделитель (1,5 → 1.5)
 * - Округляет до рубля (без копеек)
 */
export function parsePriceValue(val: unknown): number | null {
  if (val == null || val === '') return null
  let num: number
  if (typeof val === 'number' && !Number.isNaN(val)) {
    num = val
  } else {
    let s = String(val).trim()
    if (!s) return null
    s = s.replace(/[\s\u00A0\u202F]/g, '')
    s = s.replace(',', '.')
    s = s.replace(/\.(\d{3})/g, '$1')
    num = parseFloat(s)
  }
  if (Number.isNaN(num)) return null
  return Math.round(num)
}
