'use client'

import { useState } from 'react'

interface AdsPlannerClientProps {
  businessId: string | null
  businessName?: string | null
}

type SectionKeys = 'segments' | 'offers' | 'creatives' | 'plan' | 'storefront'

const sectionTitles: Record<SectionKeys, string> = {
  segments: 'Сегменты аудитории',
  offers: 'Офферы',
  creatives: 'Идеи креативов',
  plan: 'План запуска',
  storefront: 'Рекомендации по витрине',
}

function parseSections(text: string) {
  const sections: Partial<Record<SectionKeys, string>> = {}

  const extract = (key: SectionKeys, start: string, end: string) => {
    const regex = new RegExp(`${start}([\\s\\S]*?)${end}`)
    const match = text.match(regex)
    if (match && match[1]) {
      sections[key] = match[1].trim()
    }
  }

  extract('segments', '\\[SEGMENTS\\]', '\\[/SEGMENTS\\]')
  extract('offers', '\\[OFFERS\\]', '\\[/OFFERS\\]')
  extract('creatives', '\\[CREATIVES\\]', '\\[/CREATIVES\\]')
  extract('plan', '\\[PLAN\\]', '\\[/PLAN\\]')
  extract('storefront', '\\[STOREFRONT\\]', '\\[/STOREFRONT\\]')

  return sections
}

export default function AdsPlannerClient({ businessId, businessName }: AdsPlannerClientProps) {
  const [goal, setGoal] = useState<'leads' | 'messages' | 'sales' | 'awareness'>('leads')
  const [geo, setGeo] = useState('')
  const [what, setWhat] = useState('')
  const [budget, setBudget] = useState<number | ''>('')
  const [duration, setDuration] = useState<'7' | '14' | '30'>('14')
  const [offer, setOffer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawResponse, setRawResponse] = useState<string | null>(null)

  const sections = rawResponse ? parseSections(rawResponse) : {}

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!businessId) {
      setError('Не найден бизнес для планирования рекламы. Откройте страницу бизнеса и перейдите в раздел через меню.')
      return
    }

    if (!what.trim()) {
      setError('Пожалуйста, кратко опишите, что продвигаем.')
      return
    }

    setLoading(true)
    setRawResponse(null)

    const brief = {
      goal,
      geo: geo.trim() || null,
      subject: what.trim(),
      monthlyBudget: typeof budget === 'number' ? budget : null,
      durationDays: Number(duration),
      offer: offer.trim() || null,
    }

    const systemContent = [
      'Ты AI-агент Lec7, помогаешь локальному бизнесу спланировать рекламу.',
      'Отвечай кратко, по делу, без лишних вступлений.',
      'Строго используй следующий формат с тегами (без пояснений снаружи):',
      '[SEGMENTS]кратко 2–3 сегмента аудитории списком[/SEGMENTS]',
      '[OFFERS]кратко 3–5 вариантов оффера списком[/OFFERS]',
      '[CREATIVES]кратко идеи креативов для объявлений[/CREATIVES]',
      '[PLAN]краткий план запуска (каналы, шаги по неделям)[/PLAN]',
      '[STOREFRONT]рекомендации по улучшению витрины Lec7 для этого бизнеса[/STOREFRONT]',
    ].join('\n')

    const userContent =
      'Вот бриф для рекламной кампании (формат JSON, используй как структуру, но пиши ответ по-русски):\n' +
      JSON.stringify(
        {
          businessName: businessName || undefined,
          brief,
        },
        null,
        2,
      )

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent },
          ],
        }),
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        setError(data.error || 'Не удалось получить ответ от AI-агента')
        return
      }

      if (typeof data.response !== 'string') {
        setError('Неожиданный формат ответа AI')
        return
      }

      setRawResponse(data.response)
    } catch (err) {
      console.error(err)
      setError('Ошибка сети или сервера. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.2fr)', gap: '2rem' }}>
      <section>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Бриф</h2>
        <p style={{ margin: 0, marginBottom: '1.5rem', color: '#6b7280', fontSize: '0.9rem' }}>
          Заполните основные параметры, чтобы AI-агент подготовил план.
        </p>

        {businessName && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              background: '#eef2ff',
              fontSize: '0.875rem',
              color: '#3730a3',
            }}
          >
            Для бизнеса: <strong>{businessName}</strong>
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Цель рекламы
            </label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as typeof goal)}
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '0.9rem',
              }}
              disabled={loading}
            >
              <option value="leads">Заявки</option>
              <option value="messages">Сообщения</option>
              <option value="sales">Продажи</option>
              <option value="awareness">Узнаваемость</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              География
            </label>
            <input
              type="text"
              value={geo}
              onChange={(e) => setGeo(e.target.value)}
              placeholder="Город, район или радиус показов"
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '0.9rem',
              }}
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Что продвигаем
            </label>
            <input
              type="text"
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder="Услуга, продукт или направление"
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '0.9rem',
              }}
              disabled={loading}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                Месячный бюджет
              </label>
              <input
                type="number"
                value={budget}
                onChange={(e) => {
                  const value = e.target.value
                  setBudget(value === '' ? '' : Number(value))
                }}
                placeholder="Например, 30000"
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.9rem',
                }}
                min={0}
                disabled={loading}
              />
            </div>
            <div style={{ width: '40%' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                Срок кампании
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value as typeof duration)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.9rem',
                }}
                disabled={loading}
              >
                <option value="7">7 дней</option>
                <option value="14">14 дней</option>
                <option value="30">30 дней</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Оффер или особые условия
            </label>
            <textarea
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="Скидки, гарантия, бонусы, ограничения и т.п."
              rows={4}
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '0.9rem',
                resize: 'vertical',
              }}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              padding: '0.8rem 1.2rem',
              borderRadius: '6px',
              border: 'none',
              background: '#111827',
              color: 'white',
              fontSize: '0.95rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Формируем план…' : 'Сформировать план'}
          </button>
        </form>
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>AI-агент Lec7</h2>
        <p style={{ margin: 0, marginBottom: '1.5rem', color: '#6b7280', fontSize: '0.9rem' }}>
          После отправки брифа вы получите структуру кампании: сегменты, офферы, креативы и план запуска.
        </p>

        {!rawResponse && !loading && (
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderRadius: '8px',
              border: '1px dashed #d1d5db',
              color: '#6b7280',
              fontSize: '0.9rem',
            }}
          >
            Заполните бриф слева и нажмите «Сформировать план» — здесь появятся рекомендации AI.
          </div>
        )}

        {loading && (
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              background: 'white',
              fontSize: '0.9rem',
              color: '#4b5563',
            }}
          >
            AI-агент формирует план на основе брифа…
          </div>
        )}

        {!loading && rawResponse && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(Object.keys(sectionTitles) as SectionKeys[]).map((key) => {
              const content = sections[key]
              if (!content) return null

              return (
                <div
                  key={key}
                  style={{
                    padding: '1rem 1.1rem',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    background: 'white',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      marginBottom: '0.5rem',
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: '#111827',
                    }}
                  >
                    {sectionTitles[key]}
                  </h3>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: '0.9rem',
                      color: '#4b5563',
                      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    }}
                  >
                    {content}
                  </pre>
                </div>
              )
            })}

            {/* Fallback: если парсинг не удался, показываем всё целиком */}
            {Object.keys(sections).length === 0 && (
              <div
                style={{
                  padding: '1rem 1.1rem',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  background: 'white',
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '0.9rem',
                    color: '#4b5563',
                    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  {rawResponse}
                </pre>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

