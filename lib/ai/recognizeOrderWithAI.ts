/**
 * Распознавание текстовой заявки через Yandex AI (ai-gateway).
 * Возвращает структурированный массив items: [{ name, quantity, unit }].
 *
 * Env: LEC7_AI_GATEWAY_URL, LEC7_GATEWAY_SECRET
 */

export type AIOrderItem = { name: string; quantity: string; unit: string }

const RECOGNIZE_PROMPT = `Ты получаешь текстовое сообщение — заявку на продукты для кухни.
Извлеки только товарные позиции. Верни строго JSON-массив объектов:
[{ "name": "название", "quantity": "число", "unit": "кг|шт|л|г|уп|..." }]

Правила:
- name: нормализованное название товара (картошка → Картофель, морк → Морковь)
- Сохраняй полные названия с уточнениями: "тыква очищенная", не сокращай до "тыква"; "базилик красный", не "базилик"
- quantity: число как строка (10, 0.5, 2)
- unit: кг, шт, л, г, уп, ящ, кор и т.п. Если неясно — "шт"
- Ничего не придумывай
- Комментарии, заголовки, адреса — не включай
- Только валидный JSON массив, без markdown и пояснений`

/**
 * Распознать заявку через Yandex AI.
 * @throws при технической ошибке (network, timeout, 5xx, gateway error)
 */
export async function recognizeOrderWithAI(message: string): Promise<AIOrderItem[]> {
  const trimmed = (message || '').trim()
  if (!trimmed) return []

  const gatewayUrl = process.env.LEC7_AI_GATEWAY_URL?.trim()
  const gatewaySecret = process.env.LEC7_GATEWAY_SECRET?.trim()

  if (!gatewayUrl || !gatewaySecret) {
    throw new Error('AI gateway not configured')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 25000)

  try {
    const response = await fetch(`${gatewayUrl}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LEC7-GATEWAY-SECRET': gatewaySecret,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: RECOGNIZE_PROMPT },
          { role: 'user', content: trimmed },
        ],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errText = await response.text()
      console.error('[recognizeOrderWithAI] Gateway error:', response.status, errText.slice(0, 200))
      throw new Error(`AI gateway error: ${response.status}`)
    }

    const data = (await response.json()) as { reply?: string }
    const reply = (data.reply || '').trim()

    if (!reply) return []

    let jsonStr = reply
    const codeMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeMatch) jsonStr = codeMatch[1].trim()

    const start = jsonStr.indexOf('[')
    const end = jsonStr.lastIndexOf(']')
    if (start === -1 || end === -1 || end < start) return []

    jsonStr = jsonStr.slice(start, end + 1)

    const parsed = JSON.parse(jsonStr) as unknown
    if (!Array.isArray(parsed)) return []

    const items: AIOrderItem[] = []
    for (const el of parsed) {
      if (el && typeof el === 'object' && 'name' in el && typeof (el as any).name === 'string') {
        const name = String((el as any).name).trim()
        if (!name) continue
        const quantity = typeof (el as any).quantity === 'string'
          ? (el as any).quantity
          : typeof (el as any).quantity === 'number'
            ? String((el as any).quantity)
            : '1'
        const unit = typeof (el as any).unit === 'string' ? (el as any).unit.trim() : 'шт'
        items.push({ name, quantity, unit: unit || 'шт' })
      }
    }
    return items
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}
