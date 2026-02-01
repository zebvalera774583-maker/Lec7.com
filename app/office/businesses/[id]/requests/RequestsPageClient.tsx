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
  analogues?: Record<string, { name: string; price: number }[]>
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

const DEFAULT_CATEGORY = 'Свежая плодоовощная продукция'

const REQUEST_CARD_STYLE: { maxWidth: string; padding: string; border: string; borderRadius: string; boxShadow: string; cursor: string; textAlign: 'left' } = {
  maxWidth: '22em',
  padding: '1rem 1.25rem',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  cursor: 'pointer',
  textAlign: 'left',
}

function formatPrice(value: number): string {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatRequestDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function RequestsPageClient({ businessId }: RequestsPageClientProps) {
  const [showCreateBlock, setShowCreateBlock] = useState(false)
  const [viewMode, setViewMode] = useState<'form' | 'summary' | 'created'>('form')
  const [createdRequest, setCreatedRequest] = useState<{
    category: string
    createdAt: Date
    counterpartyCards: { id: string; legalName: string }[]
  } | null>(null)
  const [rows, setRows] = useState<Row[]>([{}])
  const [summaryData, setSummaryData] = useState<{ items: SummaryItem[]; counterparties: Counterparty[] } | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [appliedAnalogue, setAppliedAnalogue] = useState<Record<string, Record<string, { name: string; price: number }>>>({})
  const [useForRequest, setUseForRequest] = useState<Record<string, boolean>>({})
  const lastRowRef = useRef<HTMLInputElement>(null)
  const allCheckboxRef = useRef<HTMLInputElement>(null)

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
      const counterparties = data.counterparties || []
      setSummaryData({ items: data.items, counterparties })
      setAppliedAnalogue({})
      setUseForRequest(Object.fromEntries(counterparties.map((c: Counterparty) => [c.id, true])))
      setViewMode('summary')
    } catch (e: any) {
      setSummaryError(e.message || 'Ошибка')
    } finally {
      setSummaryLoading(false)
    }
  }

  const handleCreateRequest = () => {
    if (!summaryData) return
    const selected = summaryData.counterparties.filter((c) => useForRequest[c.id])
    const withAtLeastOnePosition = selected.filter((c) => {
      const hasOffer = summaryData.items.some((item, idx) => {
        const exact = item.offers[c.id]
        const applied = appliedAnalogue[String(idx)]?.[c.id]?.price
        const price = exact ?? applied ?? null
        return typeof price === 'number' && Number.isFinite(price) && price > 0
      })
      return hasOffer
    })
    setCreatedRequest({
      category: DEFAULT_CATEGORY,
      createdAt: new Date(),
      counterpartyCards: withAtLeastOnePosition.map((c) => ({ id: c.id, legalName: c.legalName })),
    })
    setViewMode('created')
  }

  useEffect(() => {
    if (showCreateBlock && viewMode === 'form' && rows.length > 0 && lastRowRef.current) {
      lastRowRef.current.focus()
    }
  }, [showCreateBlock, viewMode, rows.length])

  useEffect(() => {
    const el = allCheckboxRef.current
    if (!el || !summaryData?.counterparties.length) return
    const some = summaryData.counterparties.some((c) => useForRequest[c.id])
    const every = summaryData.counterparties.every((c) => useForRequest[c.id])
    el.indeterminate = some && !every
  }, [summaryData?.counterparties, useForRequest])

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
                                onKeyDown={(e) => {
                                  if (col.id === 'unit' && e.key === 'Enter') {
                                    e.preventDefault()
                                    handleAddRow()
                                  }
                                }}
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
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={handleCreateRequest}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#0070f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    >
                      Создать заявку
                    </button>
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
                </div>
                {viewMode === 'created' && createdRequest ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => setViewMode('summary')}
                      style={{ ...REQUEST_CARD_STYLE, background: '#f9fafb', width: '100%' }}
                    >
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '0.35rem' }}>
                        Сводная таблица
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.25rem' }}>
                        {createdRequest.category}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                        {formatRequestDate(createdRequest.createdAt)}
                      </div>
                    </button>
                    {createdRequest.counterpartyCards.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setViewMode('summary')}
                        style={{ ...REQUEST_CARD_STYLE, background: 'white', width: '100%' }}
                      >
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '0.35rem' }}>
                          Заявка {c.legalName}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.25rem' }}>
                          {createdRequest.category}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                          {formatRequestDate(createdRequest.createdAt)}
                        </div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setViewMode('summary')}
                      style={{
                        padding: '0.5rem 0',
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        alignSelf: 'flex-start',
                      }}
                    >
                      Назад к сводной таблице
                    </button>
                  </div>
                ) : summaryData ? (() => {
                  const sumByCounterparty: Record<string, number> = {}
                  summaryData.counterparties.forEach((c) => { sumByCounterparty[c.id] = 0 })
                  summaryData.items.forEach((item, idx) => {
                    const itemKey = String(idx)
                    const qty = Math.max(0, parseFloat(String(item.quantity).replace(',', '.')) || 0)
                    let rowMin: number | null = null
                    summaryData.counterparties.forEach((c) => {
                      const exact = item.offers[c.id]
                      const applied = appliedAnalogue[itemKey]?.[c.id]?.price
                      const p = exact ?? applied ?? null
                      if (p != null && (rowMin == null || p < rowMin)) rowMin = p
                    })
                    summaryData.counterparties.forEach((c) => {
                      const exact = item.offers[c.id]
                      const applied = appliedAnalogue[itemKey]?.[c.id]?.price
                      const p = exact ?? applied ?? null
                      if (p != null && rowMin != null && p === rowMin) {
                        sumByCounterparty[c.id] += p * qty
                      }
                    })
                  })
                  const rowTotals = summaryData.items.map((item, idx) => {
                    const itemKey = String(idx)
                    const qty = Math.max(0, parseFloat(String(item.quantity).replace(',', '.')) || 0)
                    let rowMin: number | null = null
                    summaryData.counterparties.forEach((c) => {
                      const exact = item.offers[c.id]
                      const applied = appliedAnalogue[itemKey]?.[c.id]?.price
                      const p = exact ?? applied ?? null
                      if (p != null && (rowMin == null || p < rowMin)) rowMin = p
                    })
                    return rowMin != null ? rowMin * qty : 0
                  })
                  const totalMinSum = rowTotals.reduce((a, b) => a + b, 0)
                  return (
                  <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '48px' }}>№</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '140px' }}>Наименование</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '80px' }}>Кол-во</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '60px' }}>Ед.</th>
                          {summaryData.counterparties.map((c) => (
                            <th key={c.id} style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '100px', verticalAlign: 'top' }}>
                              <div style={{ marginBottom: '0.35rem' }}>{c.legalName}</div>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <input
                                  type="checkbox"
                                  checked={!!useForRequest[c.id]}
                                  onChange={() => {
                                    setUseForRequest((prev) => ({ ...prev, [c.id]: !prev[c.id] }))
                                  }}
                                />
                                В заявку
                              </label>
                            </th>
                          ))}
                          <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '100px', verticalAlign: 'top' }}>
                            <div style={{ marginBottom: '0.35rem' }}>Итоговая сумма</div>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <input
                                ref={allCheckboxRef}
                                type="checkbox"
                                checked={summaryData.counterparties.length > 0 && summaryData.counterparties.every((c) => useForRequest[c.id])}
                                onChange={() => {
                                  const allChecked = summaryData.counterparties.every((c) => useForRequest[c.id])
                                  const next = Object.fromEntries(summaryData.counterparties.map((c) => [c.id, !allChecked]))
                                  setUseForRequest(next)
                                }}
                              />
                              Использовать для заявки: Все
                            </label>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaryData.items.map((item, idx) => {
                          const itemKey = String(idx)
                          const qty = Math.max(0, parseFloat(String(item.quantity).replace(',', '.')) || 0)
                          const effectivePrices = summaryData.counterparties.map((c) => {
                            const exact = item.offers[c.id]
                            const applied = appliedAnalogue[itemKey]?.[c.id]?.price
                            return exact ?? applied ?? null
                          }).filter((p): p is number => p != null)
                          const minPrice = effectivePrices.length > 0 ? Math.min(...effectivePrices) : null
                          const rowTotalSum = minPrice != null ? minPrice * qty : 0
                          return (
                            <tr key={idx}>
                              <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center', background: '#f9fafb' }}>{idx + 1}</td>
                              <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{item.name}</td>
                              <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>{item.quantity || '—'}</td>
                              <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{item.unit || '—'}</td>
                              {summaryData.counterparties.map((c) => {
                                const exactPrice = item.offers[c.id]
                                const appliedVal = appliedAnalogue[itemKey]?.[c.id]
                                const effectivePrice = exactPrice ?? appliedVal?.price ?? null
                                const isMin = minPrice != null && effectivePrice === minPrice
                                const analogues = item.analogues?.[c.id] || []
                                const hasAnalogue = analogues.length > 0 && exactPrice == null && !appliedVal
                                return (
                                  <td
                                    key={c.id}
                                    style={{
                                      padding: '0.75rem',
                                      border: '1px solid #e5e7eb',
                                      textAlign: 'right',
                                      backgroundColor: isMin ? '#dcfce7' : 'white',
                                      fontWeight: isMin ? 600 : 400,
                                      verticalAlign: 'top',
                                    }}
                                  >
                                    {effectivePrice != null ? (
                                      formatPrice(effectivePrice)
                                    ) : hasAnalogue ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end' }}>
                                        {analogues.slice(0, 3).map((a, i) => (
                                          <div key={i} style={{ fontSize: '0.8125rem' }}>
                                            <span style={{ color: '#4b5563' }}>{a.name}</span>
                                            <span style={{ marginLeft: '0.35rem' }}>{formatPrice(a.price)}</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setAppliedAnalogue((prev) => ({
                                                  ...prev,
                                                  [itemKey]: {
                                                    ...(prev[itemKey] || {}),
                                                    [c.id]: { name: a.name, price: a.price },
                                                  },
                                                }))
                                              }}
                                              style={{
                                                marginLeft: '0.35rem',
                                                padding: '0.2rem 0.5rem',
                                                fontSize: '0.75rem',
                                                background: '#e0f2fe',
                                                color: '#0369a1',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                              }}
                                            >
                                              Применить аналог
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                )
                              })}
                              <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right', fontWeight: rowTotalSum > 0 ? 600 : 400 }}>
                                {rowTotalSum > 0 ? formatPrice(rowTotalSum) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
                          <td colSpan={4} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Итого</td>
                          {summaryData.counterparties.map((c) => (
                            <td key={c.id} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>
                              {sumByCounterparty[c.id] > 0 ? formatPrice(sumByCounterparty[c.id]) : '—'}
                            </td>
                          ))}
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>
                            {totalMinSum > 0 ? formatPrice(totalMinSum) : '—'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  )
                })() : null}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
