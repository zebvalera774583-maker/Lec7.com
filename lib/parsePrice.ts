/**
 * Парсит цену из строки/числа. Убирает пробелы (1 030 → 1030), заменяет запятую на точку.
 */
export function parsePriceValue(val: unknown): number | null {
  if (val == null || val === '') return null
  const s = String(val).trim()
  if (!s) return null
  const normalized = s.replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(normalized)
  return Number.isNaN(num) ? null : num
}
