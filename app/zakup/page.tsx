'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

const ZAKUP_AUTHED_KEY = 'zakup:authed'
const ZAKUP_TOKEN_KEY = 'zakup:token'

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
    const businessId = needsData?.businessId ?? ''
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
                          <Link
                            href={`/office/businesses/${businessId}/request/${item.requestId}`}
                            style={{ padding: '0.35rem 0.75rem', marginRight: '0.5rem', background: '#059669', color: 'white', textDecoration: 'none', borderRadius: '4px', fontSize: '0.8125rem', display: 'inline-block' }}
                          >
                            Просмотр
                          </Link>
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
