/**
 * Парсит цену из строки/числа.
 * - Убирает пробелы (1 030 → 1030)
 * - Убирает точки как разделители тысяч (1.030 → 1030)
 * - Заменяет запятую на точку как десятичный разделитель (1,5 → 1.5)
 */
export function parsePriceValue(val: unknown): number | null {
  if (val == null || val === '') return null
  let s = String(val).trim()
  if (!s) return null
  s = s.replace(/\s/g, '')
  s = s.replace(',', '.')
  // Убираем точки как разделители тысяч: 1.030 → 1030 (точка перед ровно 3 цифрами)
  s = s.replace(/\.(\d{3})(?=$|[^\d])/g, '$1')
  const num = parseFloat(s)
  return Number.isNaN(num) ? null : num
}
