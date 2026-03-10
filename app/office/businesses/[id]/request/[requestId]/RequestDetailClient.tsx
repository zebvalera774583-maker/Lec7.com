'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const UNIT_RU: Record<string, string> = { kg: 'кг', g: 'г', l: 'л', ml: 'мл', pcs: 'шт', pc: 'шт' }
const SUMMARY_STORAGE_KEY = 'lec7_request_summary'

function formatUnit(unit: string | undefined): string {
  if (!unit) return ''
  return UNIT_RU[unit.toLowerCase()] ?? unit
}

interface ItemNeedingQuestion {
  itemName: string
  question: string
}

interface EditableItem {
  id?: string
  title?: string
  qty?: string
  unit?: string
}

interface RequestDetailClientProps {
  businessId: string
  requestId: string
  itemsJson: unknown
  descriptionFallback?: string | null
  commentsText?: string | null
  department?: string | null
  requestNumber?: number | null
  itemsNeedingQuestion?: ItemNeedingQuestion[]
}

export default function RequestDetailClient({
  businessId,
  requestId,
  itemsJson,
  descriptionFallback,
  commentsText,
  department,
  requestNumber,
  itemsNeedingQuestion = [],
}: RequestDetailClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [items, setItems] = useState<EditableItem[]>(() =>
    (Array.isArray(itemsJson) ? itemsJson : []).map((it: EditableItem) => ({
      id: it.id,
      title: it.title ?? '',
      qty: it.qty ?? '',
      unit: it.unit ?? '',
    }))
  )

  useEffect(() => {
    if (!editMode) {
      setItems(
        (Array.isArray(itemsJson) ? itemsJson : []).map((it: EditableItem) => ({
          id: it.id,
          title: it.title ?? '',
          qty: it.qty ?? '',
          unit: it.unit ?? '',
        }))
      )
    }
  }, [itemsJson, editMode])

  const handleSaveItems = async () => {
    const requestItems = items
      .map((it) => ({
        name: (it.title || '').trim(),
        quantity: (it.qty ?? '').trim() || '1',
        unit: (it.unit ?? '').trim() || 'шт',
      }))
      .filter((it) => it.name.length > 0)
    if (requestItems.length === 0) {
      setError('Добавьте хотя бы одну позицию')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/office/businesses/${businessId}/request/${requestId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: requestItems.map((it) => ({ name: it.name, quantity: it.quantity, unit: it.unit })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка сохранения')
      setItems(requestItems.map((it) => ({ title: it.name, qty: it.quantity, unit: it.unit })))
      setEditMode(false)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

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
        sessionStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify({ ...data, department: department && typeof department === 'string' && department.trim() ? department.trim() : null }))
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
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {!editMode && (
            <button
              type="button"
              onClick={() => {
                setEditMode(true)
                if (items.length === 0) setItems([{ title: '', qty: '', unit: '' }])
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {items.length > 0 ? 'Редактировать' : 'Добавить позиции'}
            </button>
          )}
          {editMode && (
            <>
              <button
                type="button"
                onClick={handleSaveItems}
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
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditMode(false)
                  setItems(
                    (Array.isArray(itemsJson) ? itemsJson : []).map((it: EditableItem) => ({
                      id: it.id,
                      title: it.title ?? '',
                      qty: it.qty ?? '',
                      unit: it.unit ?? '',
                    }))
                  )
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Отмена
              </button>
            </>
          )}
          {items.length > 0 && !editMode && (
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
                  <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, width: '3rem' }}>№</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Наименование</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Вес</th>
                  {editMode && <th style={{ padding: '0.75rem', width: '2.5rem', border: '1px solid #e5e7eb', background: '#f9fafb' }} />}
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const title = it.title || '—'
                  const qty = it.qty ?? ''
                  const unit = formatUnit(it.unit)
                  const weight = unit ? `${qty} ${unit}` : qty
                  return (
                    <tr key={it.id ?? i}>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                        {editMode ? (
                          <input
                            type="text"
                            value={it.title ?? ''}
                            onChange={(e) =>
                              setItems((prev) => {
                                const next = [...prev]
                                next[i] = { ...next[i], title: e.target.value }
                                return next
                              })
                            }
                            placeholder="Наименование"
                            style={{ width: '100%', padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }}
                          />
                        ) : (
                          title
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>
                        {editMode ? (
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                            <input
                              type="text"
                              value={it.qty ?? ''}
                              onChange={(e) =>
                                setItems((prev) => {
                                  const next = [...prev]
                                  next[i] = { ...next[i], qty: e.target.value }
                                  return next
                                })
                              }
                              placeholder="кол-во"
                              style={{ width: '4rem', padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem', textAlign: 'right' }}
                            />
                            <input
                              type="text"
                              value={it.unit ?? ''}
                              onChange={(e) =>
                                setItems((prev) => {
                                  const next = [...prev]
                                  next[i] = { ...next[i], unit: e.target.value }
                                  return next
                                })
                              }
                              placeholder="ед."
                              style={{ width: '3.5rem', padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }}
                            />
                          </div>
                        ) : (
                          weight
                        )}
                      </td>
                      {editMode && (
                        <td style={{ padding: '0.35rem', border: '1px solid #e5e7eb' }}>
                          <button
                            type="button"
                            onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                            style={{
                              padding: '0.25rem 0.5rem',
                              background: '#fef2f2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                            }}
                          >
                            ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {editMode && (
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, { title: '', qty: '', unit: '' }])}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.35rem 0.75rem',
                  background: '#f0fdf4',
                  color: '#16a34a',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                }}
              >
                + Добавить позицию
              </button>
            )}
          </div>
        )}
        {itemsNeedingQuestion.length > 0 && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ marginBottom: '0.75rem', fontSize: '0.9375rem', fontWeight: 600, color: '#92400e' }}>
              Таблица №6: Позиции, требующие уточнения
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fffbeb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#fef3c7', fontWeight: 500 }}>№ заявки</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#fef3c7', fontWeight: 500 }}>Наименование в заявке</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#fef3c7', fontWeight: 500 }}>Вопрос</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsNeedingQuestion.map((row, i) => (
                    <tr key={i}>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{requestNumber ?? '—'}</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{row.itemName}</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', fontStyle: 'italic', color: '#92400e' }}>
                        {row.question}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
