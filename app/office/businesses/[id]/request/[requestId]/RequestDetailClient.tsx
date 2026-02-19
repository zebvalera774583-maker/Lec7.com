'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface RequestDetailClientProps {
  businessId: string
  requestId: string
  requestTitle: string
  requestStatus: string
  requestCreatedAt: string
}

export default function RequestDetailClient({
  businessId,
  requestId,
  requestTitle,
  requestStatus,
  requestCreatedAt,
}: RequestDetailClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [role, setRole] = useState<'PICKER' | 'RECEIVER'>('PICKER')
  const [invite, setInvite] = useState<{ label: string; url: string; role: 'PICKER' | 'RECEIVER' } | null>(null)
  const [loading, setLoading] = useState(false)
  const [generateLoading, setGenerateLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadExisting = async () => {
    setLoading(true)
    setError(null)
    try {
      const [reqRes, bizRes] = await Promise.all([
        fetch(`/api/office/requests/${requestId}/assign-performer`, { credentials: 'include' }),
        fetch(`/api/office/businesses/${businessId}/assign-performer`, { credentials: 'include' }),
      ])
      const reqData = await reqRes.json()
      const bizData = await bizRes.json()
      if (reqRes.ok && reqData.invite) {
        setRole('PICKER')
        setInvite({ label: reqData.invite.label, url: reqData.invite.url, role: 'PICKER' })
      } else if (bizRes.ok && (bizData.receivers || [])[0]) {
        const rec = bizData.receivers[0]
        setRole('RECEIVER')
        setInvite({ label: rec.label, url: rec.url, role: 'RECEIVER' })
      } else {
        setInvite(null)
      }
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (sidebarOpen) loadExisting()
  }, [sidebarOpen, requestId, businessId])

  const handleRoleChange = (newRole: 'PICKER' | 'RECEIVER') => {
    setRole(newRole)
    setInvite(null)
  }

  const handleGenerate = async () => {
    setGenerateLoading(true)
    setError(null)
    try {
      if (role === 'RECEIVER') {
        const r = await fetch(`/api/office/businesses/${businessId}/assign-performer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ role: 'RECEIVER' }),
        })
        const data = await r.json()
        if (!r.ok) throw new Error(data?.error || 'Ошибка')
        if (data.receiver) setInvite({ ...data.receiver, role: 'RECEIVER' })
      } else {
        const r = await fetch(`/api/office/requests/${requestId}/assign-performer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ role: 'PICKER' }),
        })
        const data = await r.json()
        if (!r.ok) throw new Error(data?.error || 'Ошибка')
        if (data.invite) setInvite({ ...data.invite, role: 'PICKER' })
      }
    } catch (e: any) {
      setError(e.message || 'Ошибка')
    } finally {
      setGenerateLoading(false)
    }
  }

  const copyLink = () => {
    if (invite?.url) navigator.clipboard.writeText(invite.url)
  }

  const dateStr = new Date(requestCreatedAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href={`/office/businesses/${businessId}`} style={{ color: '#666', textDecoration: 'underline', fontSize: '0.9375rem' }}>
          ← К заявкам бизнеса
        </Link>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h1 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>{requestTitle}</h1>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Статус: {requestStatus}</p>
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Дата: {dateStr}</p>

          <div style={{ marginTop: '1.5rem' }}>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              style={{
                padding: '0.5rem 1rem',
                background: 'white',
                color: '#111827',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Назначить исполнителя
            </button>
          </div>
        </div>

        {sidebarOpen && (
          <div
            style={{
              width: '320px',
              flexShrink: 0,
              padding: '1.25rem',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>Назначить исполнителя</h2>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }}
              >
                ×
              </button>
            </div>

            {loading ? (
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Загрузка...</p>
            ) : (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#374151', marginBottom: '0.35rem' }}>
                    Должность
                  </label>
                  <select
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value as 'PICKER' | 'RECEIVER')}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.5rem',
                      fontSize: '0.875rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      background: 'white',
                    }}
                  >
                    <option value="PICKER">Сборщик</option>
                    <option value="RECEIVER">Приёмщик</option>
                  </select>
                </div>

                {!invite ? (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generateLoading}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'white',
                      color: '#111827',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      cursor: generateLoading ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    {generateLoading ? 'Генерация...' : 'Сгенерировать ссылку'}
                  </button>
                ) : (
                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.35rem' }}>
                      <strong>Исполнитель:</strong> {invite.label}
                    </p>
                    <input
                      type="text"
                      readOnly
                      value={invite.url}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        fontSize: '0.8125rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        background: '#fff',
                        marginBottom: '0.5rem',
                      }}
                    />
                    <button
                      type="button"
                      onClick={copyLink}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'white',
                        color: '#111827',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      Копировать
                    </button>
                  </div>
                )}

                <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#6b7280' }}>
                  {(invite?.role ?? role) === 'RECEIVER'
                    ? 'Ссылка даёт доступ к активации страницы приёмщика.'
                    : 'Ссылка даёт доступ к активации страницы сборщика по этой заявке.'}
                </p>
                {error && <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#dc2626' }}>{error}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
