/**
 * Нормализация сырого OCR-текста заявки через YandexGPT (ai-gateway).
 * Извлекает только товарные позиции в формате "<название> <количество> <единица>".
 *
 * Env: LEC7_AI_GATEWAY_URL, LEC7_GATEWAY_SECRET
 */

const NORMALIZE_PROMPT = `Ты получаешь сырой OCR-текст заявки кухни.
Извлеки только товарные позиции.
Каждая позиция должна быть на новой строке.
Формат строки: "<название> <количество> <единица>"
Ничего не придумывай.
Если позиция неполная, оставь только то, что явно есть.
Не добавляй комментарии, пояснения, заголовки и категории.
Не объединяй разные товары.
Выход должен быть только в виде чистого списка строк.`

/**
 * Преобразовать сырой OCR-текст в нормализованный список позиций через YandexGPT.
 * @param rawText — сырой текст от OCR
 * @returns нормализованный текст или rawText при ошибке/пустом ответе
 */
export async function normalizeOrderText(rawText: string): Promise<string> {
  const trimmed = (rawText || '').trim()
  if (!trimmed) return ''

  const gatewayUrl = process.env.LEC7_AI_GATEWAY_URL?.trim()
  const gatewaySecret = process.env.LEC7_GATEWAY_SECRET?.trim()

  if (!gatewayUrl || !gatewaySecret) {
    console.warn('[normalizeOrderText] AI gateway not configured, using raw OCR text')
    return trimmed
  }

  try {
    const response = await fetch(`${gatewayUrl}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LEC7-GATEWAY-SECRET': gatewaySecret,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: NORMALIZE_PROMPT },
          { role: 'user', content: trimmed },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.warn('[normalizeOrderText] Gateway error:', response.status, errText.slice(0, 200))
      return trimmed
    }

    const data = (await response.json()) as { reply?: string }
    const reply = (data.reply || '').trim()

    if (!reply) {
      console.warn('[normalizeOrderText] Empty reply, using raw OCR text')
      return trimmed
    }

    return reply
  } catch (err) {
    console.warn('[normalizeOrderText] Error:', err)
    return trimmed
  }
}
