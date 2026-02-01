'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

interface RequestsPageClientProps {
  businessId: string
}

interface Row {
  [key: string]: string
}

interface SummaryItem {
  name: string
  quantity: string
  unit: string
  offers: Record<string, number>
}

interface Counterparty {
  id: string
  legalName: string
}

const REQUEST_COLUMNS = [
  { id: 'name', title: 'Наименование', kind: 'text' as const },
  { id: 'quantity', title: 'Количество', kind: 'number' as const },
  { id: 'unit', title: 'Ед. изм.', kind: 'text' as const },
]

function formatPrice(value: number): string {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function RequestsPageClient({ businessId }: RequestsPageClientProps) {
  const [showCreateBlock, setShowCreateBlock] = useState(false)
  const [viewMode, setViewMode] = useState<'form' | 'summary'>('form')
  const [rows, setRows] = useState<Row[]>([{}])
  const [summaryData, setSummaryData] = useState<{ items: SummaryItem[]; counterparties: Counterparty[] } | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const lastRowRef = useRef<HTMLInputElement>(null)

  const handleAddRow = () => {
    setRows([...rows, {}])
  }

  const handleDeleteRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index))
  }

  const handleCellChange = (rowIndex: number, columnId: string, value: string) => {
    const newRows = [...rows]
    if (!newRows[rowIndex]) newRows[rowIndex] = {}
    newRows[rowIndex][columnId] = value
    setRows(newRows)
  }

  const handleFormSubmit = async () => {
    const items = rows
      .map((r) => ({ name: (r.name || '').trim(), quantity: (r.quantity || '').trim(), unit: (r.unit || '').trim() }))
      .filter((r) => r.name.length > 0)
    if (items.length === 0) {
      setSummaryError('Укажите хотя бы одну позицию с наименованием')
      return
    }
    setSummaryError(null)
    setSummaryLoading(true)
    try {
      const res = await fetch(`/api/office/businesses/${businessId}/request-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Ошибка загрузки')
      }
      const data = await res.json()
      setSummaryData({ items: data.items, counterparties: data.counterparties || [] })
      setViewMode('summary')
    } catch (e: any) {
      setSummaryError(e.message || 'Ошибка')
    } finally {
      setSummaryLoading(false)
    }
  }

  useEffect(() => {
    if (showCreateBlock && viewMode === 'form' && rows.length > 0 && lastRowRef.current) {
      lastRowRef.current.focus()
    }
  }, [showCreateBlock, viewMode, rows.length])

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '1rem', fontSize: '2rem' }}>Заявки</h1>

      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <Link
            href={`/office/businesses/${businessId}`}
            style={{ padding: '0.25rem 0', color: '#111827', fontSize: '1rem', fontWeight: 500, textDecoration: 'none', display: 'inline-block', width: 'fit-content' }}
          >
            Назад
          </Link>
          <button
            type="button"
            onClick={() => {
              setShowCreateBlock(!showCreateBlock)
              if (!showCreateBlock) setViewMode('form')
            }}
            style={{
              padding: '0.25rem 0',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 500,
              color: '#111827',
              textAlign: 'left',
              display: 'inline-block',
              width: 'fit-content',
            }}
          >
            Создать заявку
          </button>
          <p style={{ padding: '0.25rem 0', color: '#111827', fontSize: '1rem', fontWeight: 500, margin: 0 }}>
            Поступившие заявки
          </p>
          <p style={{ padding: '0.25rem 0', color: '#111827', fontSize: '1rem', fontWeight: 500, margin: 0 }}>
            Архив заявок
          </p>
        </div>

        {showCreateBlock && (
          <div style={{ flex: '1', minWidth: '320px', maxWidth: '900px' }}>
            {viewMode === 'form' ? (
              <>
                <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 500, color: '#111827' }}>Заявка</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={handleAddRow}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#f3f4f6',
                        color: '#111827',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    >
                      Добавить строку
                    </button>
                    <button
                      type="button"
                      onClick={handleFormSubmit}
                      disabled={summaryLoading}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#0070f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: summaryLoading ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    >
                      {summaryLoading ? 'Загрузка...' : 'Сформировать'}
                    </button>
                  </div>
                </div>
                {summaryError && (
                  <p style={{ marginBottom: '0.5rem', color: '#dc2626', fontSize: '0.875rem' }}>{summaryError}</p>
                )}
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '48px' }}>№ п/п</th>
                        {REQUEST_COLUMNS.map((col) => (
                          <th key={col.id} style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '120px' }}>{col.title}</th>
                        ))}
                        <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '80px' }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center', background: '#f9fafb' }}>{rowIndex + 1}</td>
                          {REQUEST_COLUMNS.map((col) => (
                            <td key={col.id} style={{ padding: 0, border: '1px solid #e5e7eb' }}>
                              <input
                                ref={rowIndex === rows.length - 1 && col.id === 'name' ? lastRowRef : undefined}
                                type={col.kind === 'number' ? 'number' : 'text'}
                                value={row[col.id] ?? ''}
                                onChange={(e) => handleCellChange(rowIndex, col.id, e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', border: 'none', fontSize: '0.875rem', background: 'white', boxSizing: 'border-box' }}
                              />
                            </td>
                          ))}
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                            <button type="button" onClick={() => handleDeleteRow(rowIndex)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: '0.25rem' }} title="Удалить строку">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 500, color: '#111827' }}>Сводная таблица</span>
                  <button
                    type="button"
                    onClick={() => setViewMode('form')}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'none',
                      color: '#111827',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    Назад к заявке
                  </button>
                </div>
                {summaryData && (
                  <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '48px' }}>№</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '140px' }}>Наименование</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '80px' }}>Кол-во</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '60px' }}>Ед.</th>
                          {summaryData.counterparties.map((c) => (
                            <th key={c.id} style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '100px' }}>{c.legalName}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {summaryData.items.map((item, idx) => {
                          const prices = summaryData.counterparties.map((c) => item.offers[c.id] ?? null).filter((p): p is number => p != null)
                          const minPrice = prices.length > 0 ? Math.min(...prices) : null
                          return (
                            <tr key={idx}>
                              <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center', background: '#f9fafb' }}>{idx + 1}</td>
                              <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{item.name}</td>
                              <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>{item.quantity || '—'}</td>
                              <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{item.unit || '—'}</td>
                              {summaryData.counterparties.map((c) => {
                                const price = item.offers[c.id]
                                const isMin = minPrice != null && price === minPrice
                                return (
                                  <td
                                    key={c.id}
                                    style={{
                                      padding: '0.75rem',
                                      border: '1px solid #e5e7eb',
                                      textAlign: 'right',
                                      backgroundColor: isMin ? '#dcfce7' : 'white',
                                      fontWeight: isMin ? 600 : 400,
                                    }}
                                  >
                                    {price != null ? formatPrice(price) : '—'}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
