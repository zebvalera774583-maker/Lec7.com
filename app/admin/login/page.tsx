'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function AdminLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка')
        setLoading(false)
        return
      }

      // Проверяем, что роль - LEC7_ADMIN
      const role = data?.user?.role
      if (role !== 'LEC7_ADMIN') {
        setError('Доступ запрещён. Требуется роль администратора.')
        setLoading(false)
        return
      }

      // Safe redirect: разрешаем только относительные пути внутри приложения
      const raw = searchParams.get('redirect')
      const safeRedirect =
        raw &&
        raw.startsWith('/') &&
        !raw.startsWith('//') &&
        !raw.toLowerCase().startsWith('http')
          ? raw
          : '/admin/owner-agent'

      router.push(safeRedirect)
      router.refresh()
    } catch {
      setError('Ошибка соединения')
      setLoading(false)
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f5f5'
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px',
      }}>
        <h1 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          Вход в админ-панель
        </h1>

        {error && (
          <div style={{
            padding: '0.75rem',
            background: '#fee',
            color: '#c00',
            borderRadius: 0,
            marginBottom: '1rem',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: 0,
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: 0,
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
              borderRadius: 0,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              marginBottom: '0.25rem',
            }}
          >
            {loading ? 'Загрузка...' : 'Войти'}
          </button>

          <div style={{ marginTop: '0.75rem', color: '#666', fontSize: '0.9rem', textAlign: 'center' }}>
            Доступ только для администратора Lec7.
          </div>
        </form>
      </div>
    </main>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Загрузка...</main>}>
      <AdminLoginContent />
    </Suspense>
  )
}
