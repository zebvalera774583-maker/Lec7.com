'use client'

import { useEffect, useState, useCallback } from 'react'

const ZAKUP_AUTHED_KEY = 'zakup:authed'
const ZAKUP_TOKEN_KEY = 'zakup:token'

const UNIT_RU: Record<string, string> = { kg: 'кг', g: 'г', l: 'л', ml: 'мл', pcs: 'шт', pc: 'шт' }

function formatUnit(unit: string | undefined): string {
  if (!unit) return ''
  return UNIT_RU[unit.toLowerCase()] ?? unit
}

interface IncomingRequest {
  linkId: string
  fromBusinessId: string
  fromLegalName: string | null
  fromName: string | null
  fromSlug: string | null
  fromResidentNumber: string | null
  createdAt: string
}

interface MaxRequest {
  requestId: string
  number: number | null
  title: string
  description: string
  createdAt: string
  department?: string | null
}

interface NeedsData {
  businessId: string
  businessName: string
  incomingRequests: IncomingRequest[]
  maxRequests: MaxRequest[]
}

function ZakupContent() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsData, setNeedsData] = useState<NeedsData | null>(null)
  const [loadingNeeds, setLoadingNeeds] = useState(false)
  const [archivingRequestId, setArchivingRequestId] = useState<string | null>(null)
  const [requestActionLoading, setRequestActionLoading] = useState<string | null>(null)
  const [viewRequestId, setViewRequestId] = useState<string | null>(null)
  const [viewRequestDetails, setViewRequestDetails] = useState<{
    id: string
    number: number | null
    title: string
    description: string
    status: string
    createdAt: string
    itemsJson: unknown
  } | null>(null)
  const [loadingView, setLoadingView] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedAuthed = sessionStorage.getItem(ZAKUP_AUTHED_KEY)
    const storedToken = sessionStorage.getItem(ZAKUP_TOKEN_KEY)
    if (storedAuthed === '1' && storedToken) {
      setAuthed(true)
      setToken(storedToken)
    } else {
      sessionStorage.removeItem(ZAKUP_AUTHED_KEY)
      sessionStorage.removeItem(ZAKUP_TOKEN_KEY)
      setAuthed(false)
    }
  }, [])

  const fetchNeeds = useCallback(async () => {
    if (!token) return
    setLoadingNeeds(true)
    try {
      const res = await fetch('/api/zakup/needs', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        sessionStorage.removeItem(ZAKUP_AUTHED_KEY)
        sessionStorage.removeItem(ZAKUP_TOKEN_KEY)
        setAuthed(false)
        setToken(null)
        return
      }
      const data = await res.json()
      if (res.ok) setNeedsData(data)
    } finally {
      setLoadingNeeds(false)
    }
  }, [token])

  useEffect(() => {
    if (authed && token) fetchNeeds()
  }, [authed, token, fetchNeeds])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/zakup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Ошибка')
        setLoading(false)
        return
      }

      const newToken = data.token
      if (newToken) {
        sessionStorage.setItem(ZAKUP_AUTHED_KEY, '1')
        sessionStorage.setItem(ZAKUP_TOKEN_KEY, newToken)
        setAuthed(true)
        setToken(newToken)
      } else {
        setError('Ошибка сервера')
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setLoading(false)
    }
  }

  const handleArchive = async (requestId: string) => {
    if (!token) return
    setArchivingRequestId(requestId)
    try {
      const res = await fetch(`/api/zakup/request/${requestId}/archive`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok && needsData) {
        setNeedsData({
          ...needsData,
          maxRequests: needsData.maxRequests.filter((r) => r.requestId !== requestId),
        })
      }
    } finally {
      setArchivingRequestId(null)
    }
  }

  const handleViewRequest = async (requestId: string) => {
    if (!token) return
    setViewRequestId(requestId)
    setViewRequestDetails(null)
    setLoadingView(true)
    try {
      const res = await fetch(`/api/zakup/request/${requestId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setViewRequestDetails(data)
      }
    } finally {
      setLoadingView(false)
    }
  }

  const handleRequestAction = async (linkId: string, action: 'accept' | 'decline') => {
    if (!token) return
    setRequestActionLoading(linkId)
    try {
      const res = await fetch(`/api/zakup/partnership/requests/${linkId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      })
      if (res.ok && needsData) {
        setNeedsData({
          ...needsData,
          incomingRequests: needsData.incomingRequests.filter((r) => r.linkId !== linkId),
        })
      }
    } finally {
      setRequestActionLoading(null)
    }
  }

  if (authed === null) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Загрузка...
      </main>
    )
  }

  if (authed) {
    const businessName = needsData?.businessName ?? '—'
    const allItems = needsData
      ? [
          ...needsData.incomingRequests.map((r) => ({ type: 'counterparty' as const, number: null as number | null, ...r })),
          ...needsData.maxRequests.map((r) => ({ type: 'max' as const, ...r, number: r.number })),
        ].sort((a, b) => ((a.number ?? 999999999) - (b.number ?? 999999999)))
      : []

    return (
      <main
        style={{
          minHeight: '100vh',
          padding: '2rem',
          background: '#f5f5f5',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ marginBottom: '0.75rem', fontSize: '1.25rem', fontWeight: 600 }}>Потребности</h2>
          {loadingNeeds ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Загрузка...</div>
          ) : allItems.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Нет потребностей</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>№</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Название / Описание</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Дата</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Подразделение</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {allItems.map((item) => (
                  <tr key={item.type === 'counterparty' ? item.linkId : item.requestId}>
                    <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{item.type === 'max' && item.number != null ? item.number : '—'}</td>
                    <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{businessName}</td>
                    <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                      {new Date(item.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                      {item.type === 'max'
                        ? (typeof (item as { department?: string | null }).department === 'string' && (item as { department?: string | null }).department?.trim()
                            ? (item as { department?: string | null }).department
                            : '—')
                        : '—'}
                    </td>
                    <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                      {item.type === 'counterparty' ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRequestAction(item.linkId, 'accept') }}
                            disabled={requestActionLoading === item.linkId}
                            style={{ padding: '0.35rem 0.75rem', marginRight: '0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: requestActionLoading === item.linkId ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}
                          >
                            Принять
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRequestAction(item.linkId, 'decline') }}
                            disabled={requestActionLoading === item.linkId}
                            style={{ padding: '0.35rem 0.75rem', background: '#f3f4f6', color: '#111827', border: '1px solid #d1d5db', borderRadius: '4px', cursor: requestActionLoading === item.linkId ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}
                          >
                            Отклонить
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleViewRequest(item.requestId) }}
                            style={{ padding: '0.35rem 0.75rem', marginRight: '0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8125rem' }}
                          >
                            Просмотр
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleArchive(item.requestId) }}
                            disabled={archivingRequestId === item.requestId}
                            style={{ padding: '0.35rem 0.75rem', background: '#f3f4f6', color: '#111827', border: '1px solid #d1d5db', borderRadius: '4px', cursor: archivingRequestId === item.requestId ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}
                          >
                            {archivingRequestId === item.requestId ? 'Архивация...' : 'Удалить'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {viewRequestId && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
              onClick={() => setViewRequestId(null)}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  maxWidth: '560px',
                  width: '90%',
                  maxHeight: '80vh',
                  overflow: 'auto',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Детали заявки</h3>
                  <button
                    type="button"
                    onClick={() => setViewRequestId(null)}
                    style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, color: '#6b7280' }}
                  >
                    ×
                  </button>
                </div>
                {loadingView ? (
                  <div style={{ padding: '2rem', textAlign: 'center' }}>Загрузка...</div>
                ) : viewRequestDetails ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>{viewRequestDetails.title}</h1>
                    <p style={{ margin: 0, color: '#6b7280' }}>Статус: {viewRequestDetails.status}</p>
                    <p style={{ margin: 0, color: '#6b7280' }}>Дата: {new Date(viewRequestDetails.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    {(() => {
                      const items = (Array.isArray(viewRequestDetails.itemsJson) ? viewRequestDetails.itemsJson : []) as { title?: string; qty?: string; unit?: string }[]
                      if (items.length === 0) return <div style={{ color: '#6b7280', marginTop: '0.5rem' }}>Нет позиций</div>
                      return (
                        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', marginTop: '0.5rem' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                              <tr>
                                <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>№</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Наименование</th>
                                <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Кол-во</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Ед.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((it, i) => (
                                <tr key={i}>
                                  <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>{i + 1}</td>
                                  <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{it.title || '—'}</td>
                                  <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>{it.qty ?? '—'}</td>
                                  <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{formatUnit(it.unit) || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Не удалось загрузить</div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: '360px',
        }}
      >
        <h1 style={{ marginBottom: '1.5rem', textAlign: 'center', fontSize: '1.25rem' }}>
          Zakup — вход
        </h1>

        {error && (
          <div
            style={{
              padding: '0.75rem',
              background: '#fee',
              color: '#c00',
              borderRadius: '4px',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? 'Проверка...' : 'Войти'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default function ZakupPage() {
  return <ZakupContent />
}
