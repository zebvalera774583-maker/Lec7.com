'use client'

import { useState, useEffect } from 'react'

interface BotLogicDoc {
  version: string
  updatedAt: string
  pipeline: { step: number; name: string; description: string }[]
  config: Record<string, number | string>
  decisionRules: { order: number; when: string; then: string; reason: string }[]
  tests: { label: string; command: string }[]
}

const cardStyle = {
  background: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '1.5rem 2rem',
  marginBottom: '1.5rem',
}

const sectionTitle = {
  fontSize: '1.125rem',
  fontWeight: 600,
  marginBottom: '1rem',
  color: '#111827',
}

export default function BotLogicPage() {
  const [data, setData] = useState<BotLogicDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/tech/bot-logic')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ width: '100%' }}>
        <h1 style={{ marginBottom: '0.5rem', fontSize: '1.875rem', fontWeight: 700 }}>
          Логика бота
        </h1>
        <p style={{ color: '#6b7280' }}>Загрузка...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ width: '100%' }}>
        <h1 style={{ marginBottom: '0.5rem', fontSize: '1.875rem', fontWeight: 700 }}>
          Логика бота
        </h1>
        <p style={{ color: '#dc2626' }}>{error}</p>
      </div>
    )
  }

  if (!data) return null

  return (
    <div style={{ width: '100%', maxWidth: '900px' }}>
      <h1 style={{ marginBottom: '0.5rem', fontSize: '1.875rem', fontWeight: 700 }}>
        Логика бота
      </h1>
      <p style={{ margin: '0 0 1.5rem 0', color: '#6b7280', fontSize: '1rem' }}>
        Orchestrator {data.version} · Данные из кода (обновляются при деплое)
      </p>

      <div style={cardStyle}>
        <div style={sectionTitle}>Pipeline</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {data.pipeline.map((p) => (
            <div
              key={p.step}
              style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
                padding: '0.5rem 0',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#e5e7eb',
                  color: '#6b7280',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                }}
              >
                {p.step}
              </span>
              <div>
                <code style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.name}</code>
                <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                  {p.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={sectionTitle}>Конфиг (пороги и лимиты)</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {Object.entries(data.config).map(([key, value]) => (
            <div
              key={key}
              style={{
                padding: '0.5rem 0.75rem',
                background: '#f9fafb',
                borderRadius: '6px',
                fontSize: '0.875rem',
              }}
            >
              <span style={{ color: '#6b7280' }}>{key}</span>
              <span style={{ fontWeight: 600, marginLeft: '0.5rem' }}>{String(value)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={sectionTitle}>Decision Engine (порядок правил)</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>#</th>
              <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>when</th>
              <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>then</th>
              <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>reason</th>
            </tr>
          </thead>
          <tbody>
            {data.decisionRules.map((r) => (
              <tr key={r.order} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.5rem 0.75rem', color: '#6b7280' }}>{r.order}</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>
                  <code>{r.when}</code>
                </td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{r.then}</td>
                <td style={{ padding: '0.5rem 0.75rem', color: '#6b7280' }}>{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={cardStyle}>
        <div style={sectionTitle}>Тесты</div>
        <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.875rem' }}>
          Перед деплоем запустите тесты, чтобы убедиться, что логика не сломана.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {data.tests.map((t, i) => (
            <div
              key={i}
              style={{
                padding: '0.75rem 1rem',
                background: '#f9fafb',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>{t.label}</div>
              <code>{t.command}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
