import OpenAI from 'openai'

// Не падаем на этапе билда, если ключ не задан.
// Ключ обязателен только при реальном вызове AI.
export const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null

/**
 * Создание AI-чата (Комната 14)
 * Генерирует ответ и создаёт заявку при необходимости
 */
export async function createAIChatResponse(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  businessContext?: {
    businessName: string
    businessDescription?: string
  }
): Promise<{
  response: string
  shouldCreateRequest: boolean
  requestData?: {
    title: string
    description: string
    clientName?: string
    clientEmail?: string
    clientPhone?: string
  }
}> {
  if (!openai) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  const systemPrompt = `Ты - AI-ассистент для бизнеса "${businessContext?.businessName || 'бизнеса'}".
${businessContext?.businessDescription ? `Описание бизнеса: ${businessContext.businessDescription}` : ''}

Твоя задача:
1. Отвечать на вопросы клиентов дружелюбно и профессионально
2. Собирать информацию о потребностях клиента
3. Если клиент готов оставить заявку или хочет получить услугу, предложи создать заявку

В конце ответа, если клиент готов оставить заявку, добавь специальный маркер: [CREATE_REQUEST]
После маркера укажи JSON с данными заявки:
{
  "title": "Краткое название заявки",
  "description": "Подробное описание",
  "clientName": "Имя клиента (если указано)",
  "clientEmail": "Email (если указан)",
  "clientPhone": "Телефон (если указан)"
}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: 0.7,
  })

  const response = completion.choices[0]?.message?.content || 'Извините, произошла ошибка.'

  // Проверяем, нужно ли создать заявку
  const shouldCreateRequest = response.includes('[CREATE_REQUEST]')
  let requestData = undefined

  if (shouldCreateRequest) {
    try {
      const jsonMatch = response.match(/\[CREATE_REQUEST\]\s*(\{[\s\S]*\})/)
      if (jsonMatch) {
        requestData = JSON.parse(jsonMatch[1])
      }
    } catch (e) {
      console.error('Error parsing request data from AI response:', e)
    }
  }

  // Убираем маркер из ответа
  const cleanResponse = response.replace(/\[CREATE_REQUEST\][\s\S]*$/, '').trim()

  return {
    response: cleanResponse,
    shouldCreateRequest,
    requestData,
  }
}
