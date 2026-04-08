import { KEYWORDS } from './keywords.js'

export interface ExtractedSignal {
  text: string
  /** Какая ключевая фраза сработала */
  source: string
}

const CONTEXT_BEFORE = 80
const CONTEXT_AFTER = 120

/** Меню / вкладки выдачи — убираем до поиска по ключам (длинные фразы первыми). */
const NAV_BLACKLIST: string[] = [
  'перейти к контенту',
  'изображения',
  'новости',
  'видео',
  'карты',
  'поиск',
  'english',
].sort((a, b) => b.length - a.length)

const MIN_SIGNAL_CHARS = 31
const MAX_SIGNAL_CHARS = 200

/** Страница без нормального текста (только UI) — сигналов не будет. */
const MIN_PAGE_CHARS = 50
const MIN_PAGE_WORDS = 8

/** Грубое удаление тегов; для публичных HTML достаточно. */
function htmlToPlainText(html: string): string {
  const noScript = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  const stripped = noScript.replace(/<[^>]+>/g, ' ')
  return stripped.replace(/\s+/g, ' ').trim()
}

function stripBlacklist(text: string): string {
  let s = text
  for (const phrase of NAV_BLACKLIST) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    s = s.replace(new RegExp(escaped, 'gi'), ' ')
  }
  return s.replace(/\s+/g, ' ').trim()
}

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** Убирает подряд идущие одинаковые слова (частый мусор в верстке). */
function dedupeConsecutiveWords(s: string): string {
  const parts = s.split(/\s+/).filter(Boolean)
  const out: string[] = []
  for (const w of parts) {
    const prev = out[out.length - 1]
    if (prev !== undefined && prev.toLowerCase() === w.toLowerCase()) continue
    out.push(w)
  }
  return out.join(' ')
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length
}

/** Слишком мало текста после вырезания навигации — похоже на чистый UI. */
function isLikelyUiOnlyPage(cleanedPlain: string): boolean {
  if (cleanedPlain.length < MIN_PAGE_CHARS) return true
  if (wordCount(cleanedPlain) < MIN_PAGE_WORDS) return true
  return false
}

function chunkContainsKeyword(chunkLower: string, phraseLower: string): boolean {
  return chunkLower.includes(phraseLower)
}

function finalizeChunk(raw: string): string {
  let s = normalizeSpaces(stripBlacklist(raw))
  s = dedupeConsecutiveWords(s)
  if (s.length > MAX_SIGNAL_CHARS) {
    s = `${s.slice(0, MAX_SIGNAL_CHARS - 1)}…`
  }
  return s
}

/**
 * Ищет ключевые фразы в очищенном тексте и возвращает фрагменты только при прохождении фильтров.
 */
export function extractSignals(html: string): ExtractedSignal[] {
  const plain = htmlToPlainText(html)
  if (!plain) return []

  const cleanedPlain = stripBlacklist(plain)
  if (isLikelyUiOnlyPage(cleanedPlain)) {
    return []
  }

  const lower = cleanedPlain.toLowerCase()
  const out: ExtractedSignal[] = []
  const seen = new Set<string>()

  for (const phrase of KEYWORDS) {
    const needle = phrase.toLowerCase()
    let from = 0
    while (from < lower.length) {
      const idx = lower.indexOf(needle, from)
      if (idx === -1) break

      const start = Math.max(0, idx - CONTEXT_BEFORE)
      const end = Math.min(cleanedPlain.length, idx + needle.length + CONTEXT_AFTER)
      let chunk = finalizeChunk(cleanedPlain.slice(start, end))

      if (chunk.length < MIN_SIGNAL_CHARS) {
        from = idx + needle.length
        continue
      }
      if (!chunkContainsKeyword(chunk.toLowerCase(), needle)) {
        from = idx + needle.length
        continue
      }

      const key = `${phrase}:${idx}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push({ text: chunk, source: phrase })
      }
      from = idx + needle.length
    }
  }

  if (out.length > 0) {
    const preview = out[0].text.replace(/\s+/g, ' ').slice(0, 90)
    console.log(`[web-hunter/parser] accepted ${out.length} signal(s), e.g.: ${preview}${out[0].text.length > 90 ? '…' : ''}`)
  }

  return out
}
