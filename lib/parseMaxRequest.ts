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
  const src = description || cleanTitle || text
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
