'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Supplier {
  supplierBusinessId: string
  supplierLegalName: string
  priceListId: string
  priceListUpdatedAt: string
}

interface Offer {
  price: number | null
  unit: string | null
}

interface Row {
  no: number
  title: string
  normTitle: string
  offers: Record<string, Offer>
}

interface ComparisonData {
  counterpartyBusinessId: string
  suppliers: Supplier[]
  rows: Row[]
}

interface PriceCompareClientProps {
  businessId: string
}

function formatPrice(value: number | null): string {
  if (value == null) return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function PriceCompareClient({ businessId }: PriceCompareClientProps) {
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [onlyWith2Offers, setOnlyWith2Offers] = useState(false)
  const [hideEmptySuppliers, setHideEmptySuppliers] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/office/businesses/${businessId}/price-comparison`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Доступ запрещён' : 'Ошибка загрузки')
        return res.json()
      })
      .then((d: ComparisonData) => {
        if (!cancelled) {
          setData(d)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Ошибка')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [businessId])

  if (loading) {
    return (
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <p style={{ color: '#6b7280' }}>Загрузка...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <p style={{ color: '#b91c1c' }}>{error}</p>
        <Link href={`/office/businesses/${businessId}/partnership`} style={{ color: '#2563eb', marginTop: '0.5rem', display: 'inline-block' }}>
          ← Назад к партнёрству
        </Link>
      </div>
    )
  }

  if (!data) {
    return null
  }

  // 1) Filter rows: only rows with >= 2 offers (non-null price)
  let filteredRows = data.rows
  if (onlyWith2Offers) {
    filteredRows = data.rows.filter((row) => {
      const count = Object.values(row.offers).filter((o) => o?.price != null).length
      return count >= 2
    })
  }

  // 2) Hide suppliers that have no price in any visible row
  let visibleSuppliers = data.suppliers
  if (hideEmptySuppliers && filteredRows.length > 0) {
    const emptySupplierIds = new Set<string>()
    for (const sup of data.suppliers) {
      const hasAny = filteredRows.some((row) => {
        const o = row.offers[sup.supplierBusinessId]
        return o?.price != null
      })
      if (!hasAny) emptySupplierIds.add(sup.supplierBusinessId)
    }
    visibleSuppliers = data.suppliers.filter((s) => !emptySupplierIds.has(s.supplierBusinessId))
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '100%', margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <Link
          href={`/office/businesses/${businessId}/partnership`}
          style={{ color: '#2563eb', fontSize: '0.875rem' }}
        >
          ← Назад к партнёрству
        </Link>
      </div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Сравнение прайсов</h1>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
          <input
            type="checkbox"
            checked={onlyWith2Offers}
            onChange={(e) => setOnlyWith2Offers(e.target.checked)}
          />
          Только позиции с ≥2 предложениями
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
          <input
            type="checkbox"
            checked={hideEmptySuppliers}
            onChange={(e) => setHideEmptySuppliers(e.target.checked)}
          />
          Скрыть пустых поставщиков
        </label>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              <th
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  background: '#f9fafb',
                  padding: '0.75rem',
                  textAlign: 'left',
                  border: '1px solid #e5e7eb',
                  fontWeight: 500,
                  minWidth: '48px',
                }}
              >
                №
              </th>
              <th
                style={{
                  position: 'sticky',
                  left: '48px',
                  zIndex: 2,
                  background: '#f9fafb',
                  padding: '0.75rem',
                  textAlign: 'left',
                  border: '1px solid #e5e7eb',
                  fontWeight: 500,
                  minWidth: '200px',
                }}
              >
                Наименование
              </th>
              {visibleSuppliers.map((s) => (
                <th
                  key={s.supplierBusinessId}
                  style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    border: '1px solid #e5e7eb',
                    background: '#f9fafb',
                    fontWeight: 500,
                    minWidth: '120px',
                  }}
                >
                  {s.supplierLegalName || s.supplierBusinessId}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={2 + visibleSuppliers.length} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                  Нет данных для отображения
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => (
                <tr key={row.normTitle + idx}>
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      background: 'white',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #e5e7eb',
                      textAlign: 'center',
                    }}
                  >
                    {idx + 1}
                  </td>
                  <td
                    style={{
                      position: 'sticky',
                      left: '48px',
                      zIndex: 1,
                      background: 'white',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    {row.title}
                  </td>
                  {visibleSuppliers.map((s) => {
                    const offer = row.offers[s.supplierBusinessId]
                    const price = offer?.price ?? null
                    const unit = offer?.unit ?? null
                    const displayPrice = formatPrice(price)
                    return (
                      <td
                        key={s.supplierBusinessId}
                        style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb' }}
                        title={unit ? `за ${unit}` : undefined}
                      >
                        <span>{displayPrice}</span>
                        {unit && (
                          <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginTop: '2px' }}>
                            за {unit}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
