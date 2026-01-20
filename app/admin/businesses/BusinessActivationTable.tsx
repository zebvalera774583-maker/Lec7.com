'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Business {
  id: string
  name: string
  slug: string
  lifecycleStatus: string | null
  billingStatus: string | null
  createdAt: Date
}

interface BusinessActivationTableProps {
  businesses: Business[]
}

export default function BusinessActivationTable({ businesses: initialBusinesses }: BusinessActivationTableProps) {
  const router = useRouter()
  const [businesses, setBusinesses] = useState(initialBusinesses)
  const [activating, setActivating] = useState<Set<string>>(new Set())

  const handleActivate = async (businessId: string) => {
    if (activating.has(businessId)) return

    setActivating((prev) => new Set(prev).add(businessId))

    try {
      const response = await fetch(`/api/owner/businesses/${businessId}/activate`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Ошибка активации' }))
        alert(error.error || 'Ошибка активации бизнеса')
        return
      }

      // Обновляем локальное состояние
      setBusinesses((prev) =>
        prev.map((b) => (b.id === businessId ? { ...b, lifecycleStatus: 'ACTIVE' } : b))
      )

      // Обновляем страницу для синхронизации
      router.refresh()
    } catch (error) {
      console.error('Activation error:', error)
      alert('Ошибка при активации бизнеса')
    } finally {
      setActivating((prev) => {
        const next = new Set(prev)
        next.delete(businessId)
        return next
      })
    }
  }

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                Название
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                Slug
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                Lifecycle
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                Billing
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                Создан
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                Действия
              </th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((business) => {
              const isActive = business.lifecycleStatus === 'ACTIVE'
              const isActivating = activating.has(business.id)
              const canActivate = !isActive && !isActivating

              return (
                <tr
                  key={business.id}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                    <div style={{ fontWeight: 500, color: '#111827' }}>{business.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace', marginTop: '0.25rem' }}>
                      {business.id.slice(0, 8)}...
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                    <span style={{ fontFamily: 'monospace', color: '#6b7280' }}>/{business.slug}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        background: isActive ? '#d1fae5' : '#fef3c7',
                        color: isActive ? '#065f46' : '#92400e',
                      }}
                    >
                      {business.lifecycleStatus || 'DRAFT'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        background: business.billingStatus === 'PAID' ? '#dbeafe' : '#fee2e2',
                        color: business.billingStatus === 'PAID' ? '#1e40af' : '#991b1b',
                      }}
                    >
                      {business.billingStatus || 'UNPAID'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    {new Date(business.createdAt).toLocaleDateString('ru-RU', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                    {canActivate ? (
                      <button
                        onClick={() => handleActivate(business.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#0070f3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#0051cc'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#0070f3'
                        }}
                      >
                        Активировать без оплаты
                      </button>
                    ) : isActive ? (
                      <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Активен</span>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Активация...</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
