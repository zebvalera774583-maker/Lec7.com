import { KEYWORDS } from './keywords.js'

export interface ExtractedSignal {
  text: string
  /** Какая ключевая фраза сработала */
  source: string
}

const CONTEXT_BEFORE = 80
const CONTEXT_AFTER = 120

/** Грубое удаление тегов; для публичных HTML достаточно. */
function htmlToPlainText(html: string): string {
  const noScript = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  const stripped = noScript.replace(/<[^>]+>/g, ' ')
  return stripped.replace(/\s+/g, ' ').trim()
}

/**
 * Ищет вхождения ключевых слов в тексте страницы и возвращает фрагменты ~100–200 символов вокруг.
 */
export function extractSignals(html: string): ExtractedSignal[] {
  const plain = htmlToPlainText(html)
  if (!plain) return []

  const lower = plain.toLowerCase()
  const out: ExtractedSignal[] = []
  const seen = new Set<string>()

  for (const phrase of KEYWORDS) {
    const needle = phrase.toLowerCase()
    let from = 0
    while (from < lower.length) {
      const idx = lower.indexOf(needle, from)
      if (idx === -1) break

      const start = Math.max(0, idx - CONTEXT_BEFORE)
      const end = Math.min(plain.length, idx + needle.length + CONTEXT_AFTER)
      let chunk = plain.slice(start, end).trim()
      if (chunk.length < 40) {
        from = idx + needle.length
        continue
      }
      if (chunk.length > 220) chunk = `${chunk.slice(0, 217)}…`

      const key = `${phrase}:${start}:${end}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push({ text: chunk, source: phrase })
      }
      from = idx + needle.length
    }
  }

  return out
}
