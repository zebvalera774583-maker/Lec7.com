'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const UNIT_RU: Record<string, string> = { kg: 'кг', g: 'г', l: 'л', ml: 'мл', pcs: 'шт', pc: 'шт' }
const SUMMARY_STORAGE_KEY = 'lec7_request_summary'

function formatUnit(unit: string | undefined): string {
  if (!unit) return ''
  return UNIT_RU[unit.toLowerCase()] ?? unit
}

interface RequestDetailClientProps {
  businessId: string
  itemsJson: unknown
  descriptionFallback?: string | null
  commentsText?: string | null
  department?: string | null
}

export default function RequestDetailClient({
  businessId,
  itemsJson,
  descriptionFallback,
  commentsText,
  department,
}: RequestDetailClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const items = (Array.isArray(itemsJson) ? itemsJson : []) as { title?: string; qty?: string; unit?: string }[]

  const handleFormSummary = async () => {
    const requestItems = items
      .map((it) => ({
        name: (it.title || '').trim(),
        quantity: (it.qty ?? '').trim(),
        unit: (it.unit ?? '').trim(),
      }))
      .filter((it) => it.name.length > 0)
    if (requestItems.length === 0) {
      setError('Нет позиций для сводной таблицы')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/office/businesses/${businessId}/request-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items: requestItems, category: 'Свежая плодоовощная продукция' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки')
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify(data))
      }
      router.push(`/office/businesses/${businessId}/requests?section=create&fromSummary=1`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <Link href={`/office/businesses/${businessId}/partnership`} style={{ color: '#666', textDecoration: 'underline', fontSize: '0.9375rem' }}>
          ← Назад
        </Link>
        {items.length > 0 && (
          <button
            type="button"
            onClick={handleFormSummary}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              background: loading ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {loading ? 'Загрузка...' : 'Сформировать сводную таблицу'}
          </button>
        )}
      </div>
      {error && <p style={{ marginBottom: '0.5rem', color: '#dc2626', fontSize: '0.875rem' }}>{error}</p>}
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        {department && typeof department === 'string' && department.trim() && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.875rem', color: '#4b5563' }}>
            <strong>Подразделение:</strong> {department.trim()}
          </div>
        )}
        {commentsText && commentsText.trim() && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.875rem', color: '#4b5563', whiteSpace: 'pre-wrap' }}>
            <strong>Комментарий:</strong> {commentsText.trim()}
          </div>
        )}
        {items.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            {descriptionFallback ? (
              <>
                <div style={{ marginBottom: '0.5rem', fontWeight: 500 }}>Описание</div>
                <div>{descriptionFallback}</div>
              </>
            ) : (
              'Нет позиций'
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Наименование</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Вес</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const title = it.title || '—'
                  const qty = it.qty ?? ''
                  const unit = formatUnit(it.unit)
                  const weight = unit ? `${qty} ${unit}` : qty
                  return (
                    <tr key={i}>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{title}</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{weight}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
