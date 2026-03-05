import { prisma } from '@/lib/prisma'

function normalizeForMatch(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Строит map alias -> canonicalName из BotCatalogItem.
 * alias = canonicalName и все synonyms (normalized).
 */
export async function buildAliasToCanonicalMap(): Promise<Map<string, string>> {
  const items = await prisma.botCatalogItem.findMany({
    where: { scope: 'GLOBAL', isActive: true },
    select: { canonicalName: true, synonyms: true },
  })
  const map = new Map<string, string>()
  for (const item of items) {
    const canonical = item.canonicalName
    const add = (alias: string) => {
      const norm = normalizeForMatch(alias)
      if (norm && !map.has(norm)) map.set(norm, canonical)
    }
    add(canonical)
    for (const syn of item.synonyms) add(syn)
  }
  return map
}

/**
 * PreNormalizer 2.1: удалить () [] {} " ', сохранить - . ,
 */
function removeSpecChars(s: string): string {
  return (s || '').replace(/[()\[\]{}"']/g, '')
}

/**
 * Чистит мусор: удаление спецсимволов, точки (репч. -> репч), лишние дефисы, двойные пробелы.
 */
function cleanGarbage(s: string): string {
  return removeSpecChars(s || '')
    .trim()
    .toLowerCase()
    .replace(/\.(?=[^0-9]|$)/g, '') // убрать точки не между цифрами
    .replace(/\.{2,}/g, ' ')
    .replace(/\s*[-–—]+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Извлекает "title part" (до количества) из строки.
 * Примеры: "Лук репч.-2кг" -> "Лук репч.", "Чеснок 0,500" -> "Чеснок"
 */
function extractTitlePart(line: string): string {
  const m = line.match(/^([^\d]+?)(?=[\s\-–—]*\d)/)
  return m ? m[1].trim() : line.trim()
}

/**
 * Проверяет, совпадает ли titlePart с alias или содержит его.
 * Возвращает canonicalName при совпадении.
 */
function findMatchingCanonical(titlePart: string, aliasMap: Map<string, string>): string | null {
  const cleaned = cleanGarbage(titlePart)
  if (!cleaned) return null
  const norm = normalizeForMatch(cleaned)
  // Exact match
  if (aliasMap.has(norm)) return aliasMap.get(norm)!
  // Contains: title содержит alias ИЛИ alias содержит title (для "морк" -> "морковь")
  let best: { len: number; canonical: string } | null = null
  for (const [alias, canonical] of aliasMap) {
    if (alias.length < 2) continue
    const match = norm.includes(alias) || alias.includes(norm)
    if (match) {
      const len = Math.min(alias.length, norm.length)
      if (!best || len > best.len) best = { len, canonical }
    }
  }
  return best?.canonical ?? null
}

/**
 * Разбить текст на строки потребности (newline, ;, " и ", запятая не между цифрами).
 */
export function splitNeedLines(text: string): string[] {
  return text
    .split(/[\n;]|\s+и\s+|(?<!\d),(?!\d)/i)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Pre-normalize: для каждой строки потребности чистит, извлекает title,
 * заменяет на canonicalName если совпадение. Возвращает нормализованный текст.
 */
export function preNormalizeLines(
  lines: string[],
  aliasMap: Map<string, string>
): string[] {
  return lines.map((line) => {
    const cleaned = cleanGarbage(line)
    const titlePart = extractTitlePart(cleaned)
    const canonical = findMatchingCanonical(titlePart, aliasMap)
    if (canonical) {
      // Заменяем title part на canonical, сохраняем qty и unit
      const rest = cleaned.slice(titlePart.length).trim()
      return `${canonical} ${rest}`.trim()
    }
    return cleaned
  })
}
