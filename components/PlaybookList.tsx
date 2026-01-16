'use client'

import { useEffect, useState } from 'react'

type PlaybookItem = {
  id: string
  scope: string
  businessId?: string | null
  title: string
  move: string
  context?: string | null
  outcome?: string | null
  confidence: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export default function PlaybookList() {
  const [items, setItems] = useState<PlaybookItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    ;(async () => {
      try {
        setError('')
        setLoading(true)
        const res = await fetch('/api/agent-playbook?scope=PLATFORM', {
          method: 'GET',
          credentials: 'include',
        })
        if (res.status === 403) {
          setError('Нет доступа к playbook')
          return
        }
        if (!res.ok) throw new Error('Не удалось загрузить playbook')

        const data = (await res.json()) as PlaybookItem[]
        // Берем последние 15 карточек
        setItems((data || []).slice(0, 15))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки playbook')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'HIGH':
        return '#10b981' // green
      case 'MEDIUM':
        return '#3b82f6' // blue
      case 'LOW':
        return '#f59e0b' // yellow
      default:
        return '#6b7280' // gray
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
        Загрузка...
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          padding: '1rem',
          background: '#fff1f2',
          border: '1px solid #fecdd3',
          borderRadius: '8px',
          color: '#be123c',
        }}
      >
        {error}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
        Нет карточек опыта. Начните работу с Owner Agent, чтобы накапливать опыт.
      </div>
    )
  }

  return (
    <div>
      <div
        style={{
          padding: '1rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
          Последний опыт (Playbook)
        </h3>
        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          {items.length} карточек
        </span>
      </div>

      <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '1rem',
              borderBottom: '1px solid #f1f5f9',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '0.5rem',
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    marginBottom: '0.25rem',
                  }}
                >
                  {item.title}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    marginBottom: '0.5rem',
                  }}
                >
                  {formatDate(item.createdAt)}
                </div>
              </div>
              <div
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  background: getConfidenceColor(item.confidence) + '20',
                  color: getConfidenceColor(item.confidence),
                }}
              >
                {item.confidence}
              </div>
            </div>

            <div
              style={{
                fontSize: '0.875rem',
                color: '#374151',
                marginBottom: '0.5rem',
                whiteSpace: 'pre-wrap',
              }}
            >
              <strong>Действие:</strong> {item.move}
            </div>

            {item.outcome && (
              <div
                style={{
                  fontSize: '0.875rem',
                  color: '#6b7280',
                  marginBottom: '0.5rem',
                  whiteSpace: 'pre-wrap',
                }}
              >
                <strong>Результат:</strong> {item.outcome}
              </div>
            )}

            {item.tags && item.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.5rem' }}>
                {item.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '0.125rem 0.5rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      background: '#e5e7eb',
                      color: '#374151',
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div
              style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginTop: '0.5rem',
              }}
            >
              {item.scope === 'PLATFORM' ? 'Платформа' : 'Бизнес'}
              {item.businessId && ` • ${item.businessId.slice(0, 8)}...`}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
