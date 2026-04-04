/**
 * Исправление орфографии / очевидных опечаток только в названиях товаров через AI gateway.
 * Не встроен в intake-пайплайн — вызывается опционально снаружи (например, из normalizeIncomingOrder позже).
 *
 * Env: LEC7_AI_GATEWAY_URL, LEC7_GATEWAY_SECRET
 */

export type CorrectedNameItem = {
  index: number
  corrected_name: string
  ai_confidence: number
  unchanged: boolean
}

export type CorrectProductNamesResult = {
  items: CorrectedNameItem[]
}

/** Таймаут HTTP-запроса к gateway (один батч названий). */
export const CORRECT_PRODUCT_NAMES_TIMEOUT_MS = 20_000

const SYSTEM_PROMPT = `Ты исправляешь только орфографию и очевидные опечатки в названиях продуктов для кухни/бара (русский язык).
Тебе дают нумерованный список строк — каждая строка это ТОЛЬКО наименование товара, без количества и единиц.

Жёсткие правила:
- Исправляй только написание названия; не добавляй и не убирай слова, не подменяй товар на другой.
- Не включай числа, не включай единицы (кг, шт, л, г и т.д.) — их в строках не должно быть; если видишь число или единицу, всё равно верни только исправленное название товара без них.
- Если сомневаешься или строка уже корректна — верни то же название, unchanged: true, ai_confidence не выше 0.5.
- Не выдумывай позиции, которых нет в формулировке.

Формат ответа — один JSON-объект без markdown и без текста вне JSON:
{"items":[{"index":0,"corrected_name":"строка","ai_confidence":0.0,"unchanged":true}]}

Поля каждого элемента:
- index: целое число, позиция в списке (0, 1, …)
- corrected_name: итоговая строка названия (непустая)
- ai_confidence: число от 0 до 1 — твоя уверенность в исправлении
- unchanged: true если исправлений не было или ты сознательно не менял строку

Должен быть ровно один элемент items[] на каждую входную строку, индексы без пропусков и дубликатов.`

function buildUserPayload(names: string[]): string {
  return names.map((name, i) => `${i}. ${name}`).join('\n')
}

function safeFallback(names: string[]): CorrectProductNamesResult {
  return {
    items: names.map((corrected_name, index) => ({
      index,
      corrected_name,
      ai_confidence: 0,
      unchanged: true,
    })),
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Строгая проверка ответа модели. При любой несогласованности — null (вызывающий сделает fallback).
 */
function parseAndValidateStructuredReply(
  data: unknown,
  originals: string[]
): CorrectProductNamesResult | null {
  if (!isPlainObject(data)) return null
  const itemsRaw = data.items
  if (!Array.isArray(itemsRaw)) return null
  if (itemsRaw.length !== originals.length) return null

  const byIndex = new Map<number, CorrectedNameItem>()
  for (const el of itemsRaw) {
    if (!isPlainObject(el)) return null
    const index = el.index
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= originals.length) {
      return null
    }
    if (byIndex.has(index)) return null

    const corrected_name = el.corrected_name
    if (typeof corrected_name !== 'string') return null
    const trimmed = corrected_name.trim()
    if (!trimmed) return null

    const ac = el.ai_confidence
    if (typeof ac !== 'number' || !Number.isFinite(ac)) return null
    if (ac < 0 || ac > 1) return null

    const unchanged = el.unchanged
    if (typeof unchanged !== 'boolean') return null

    byIndex.set(index, {
      index,
      corrected_name: trimmed,
      ai_confidence: ac,
      unchanged,
    })
  }

  if (byIndex.size !== originals.length) return null
  const items: CorrectedNameItem[] = []
  for (let i = 0; i < originals.length; i++) {
    const it = byIndex.get(i)
    if (!it) return null
    items.push(it)
  }
  return { items }
}

function extractJsonObject(reply: string): unknown | null {
  let s = reply.trim()
  const codeMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (codeMatch) s = codeMatch[1].trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(s.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

/**
 * Запрос к AI: исправить названия в том же порядке.
 * Не бросает исключений наружу: при любой ошибке возвращает исходные имена (unchanged: true, ai_confidence: 0).
 */
export async function correctProductNamesForCatalog(names: string[]): Promise<CorrectProductNamesResult> {
  const originals = names.map((n) => (n ?? '').trim())
  if (originals.length === 0) return { items: [] }

  const gatewayUrl = process.env.LEC7_AI_GATEWAY_URL?.trim()
  const gatewaySecret = process.env.LEC7_GATEWAY_SECRET?.trim()
  if (!gatewayUrl || !gatewaySecret) {
    return safeFallback(originals)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CORRECT_PRODUCT_NAMES_TIMEOUT_MS)

  try {
    const response = await fetch(`${gatewayUrl}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LEC7-GATEWAY-SECRET': gatewaySecret,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPayload(originals) },
        ],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.warn('[correctProductNamesForCatalog] gateway HTTP', response.status)
      return safeFallback(originals)
    }

    const payload = (await response.json()) as { reply?: string }
    const reply = (payload.reply ?? '').trim()
    if (!reply) {
      return safeFallback(originals)
    }

    const parsed = extractJsonObject(reply)
    if (parsed === null) {
      console.warn('[correctProductNamesForCatalog] JSON parse failed')
      return safeFallback(originals)
    }

    const validated = parseAndValidateStructuredReply(parsed, originals)
    if (validated === null) {
      console.warn('[correctProductNamesForCatalog] structure validation failed')
      return safeFallback(originals)
    }

    return validated
  } catch (err) {
    clearTimeout(timeoutId)
    const msg = err instanceof Error ? err.message : String(err)
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[correctProductNamesForCatalog] timeout')
    } else {
      console.warn('[correctProductNamesForCatalog] error:', msg)
    }
    return safeFallback(originals)
  }
}
