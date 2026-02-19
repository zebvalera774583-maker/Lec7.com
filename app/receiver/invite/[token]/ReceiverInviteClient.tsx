'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ReceiverInviteClient() {
  const router = useRouter()
  useEffect(() => {
    fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
  }, [])

  const handleGoToRequests = () => {
    router.push('/receiver/requests')
    router.refresh()
  }

  return (
    <div
      style={{
        maxWidth: '400px',
        margin: '0 auto',
        padding: '2rem',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <p style={{ marginBottom: '1.5rem', fontSize: '1rem', color: '#374151' }}>
        Страница приёмщика активирована
      </p>
      <button
        type="button"
        onClick={handleGoToRequests}
        style={{
          padding: '0.5rem 1rem',
          background: '#111827',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.9375rem',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Перейти к заявкам
      </button>
    </div>
  )
}
