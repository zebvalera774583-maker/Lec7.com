'use client'

import Link from 'next/link'

const UNIT_RU: Record<string, string> = { kg: 'кг', g: 'г', l: 'л', ml: 'мл', pcs: 'шт', pc: 'шт' }

function formatUnit(unit: string | undefined): string {
  if (!unit) return ''
  return UNIT_RU[unit.toLowerCase()] ?? unit
}

interface RequestDetailClientProps {
  businessId: string
  itemsJson: unknown
  descriptionFallback?: string | null
}

export default function RequestDetailClient({
  businessId,
  itemsJson,
  descriptionFallback,
}: RequestDetailClientProps) {
  const items = (Array.isArray(itemsJson) ? itemsJson : []) as { title?: string; qty?: string; unit?: string }[]

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href={`/office/businesses/${businessId}/partnership`} style={{ color: '#666', textDecoration: 'underline', fontSize: '0.9375rem' }}>
          ← Назад
        </Link>
      </div>

      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
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
