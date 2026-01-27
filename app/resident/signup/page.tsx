"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ResidentSignupPage() {
  const router = useRouter()
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!businessName.trim()) {
      setError('Введите название бизнеса')
      return
    }

    if (!email.trim() || !password.trim()) {
      setError('Email и пароль обязательны')
      return
    }

    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/resident/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name: businessName,
          city: city || undefined,
          category: category || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error === 'USER_ALREADY_EXISTS') {
          setError('Аккаунт с таким email уже существует. Перейдите на страницу входа.')
        } else if (data.message) {
          setError(data.message)
        } else {
          setError(data.error || 'Ошибка при регистрации')
        }
        setLoading(false)
        return
      }

      // Успешная регистрация: пользователь уже залогинен, бизнес создан
      const businessId = data.business?.id
      if (businessId) {
        router.push(`/office/businesses/${businessId}/profile`)
      } else {
        router.push('/office')
      }
      router.refresh()
    } catch (err) {
      setError('Ошибка соединения')
      setLoading(false)
    }
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
          maxWidth: '480px',
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            marginBottom: '1rem',
            padding: 0,
            background: 'none',
            border: 'none',
            color: '#0070f3',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <span aria-hidden="true">←</span>
          <span>Назад</span>
        </button>

        <h1 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Регистрация резидента</h1>
        <p style={{ marginTop: 0, marginBottom: '1.5rem', textAlign: 'center', color: '#666', fontSize: '0.95rem' }}>
          Создайте аккаунт и бизнес на Lec7, чтобы управлять витриной и заявками.
        </p>

        {error && (
          <div
            style={{
              padding: '0.75rem',
              background: '#fee',
              color: '#c00',
              borderRadius: '4px',
              marginBottom: '1rem',
              fontSize: '0.9rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Название бизнеса</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              placeholder="Например, StudioOne"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
              }}
            />
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#777' }}>
              Только латинские буквы, цифры, пробелы и дефисы (как в API создания бизнеса).
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Город (опционально)</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Москва"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Категория (опционально)</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Дизайн, ремонт..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>

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
                borderRadius: '4px',
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
              marginBottom: '0.75rem',
            }}
          >
            {loading ? 'Создаём аккаунт и бизнес...' : 'Создать аккаунт и бизнес'}
          </button>

          <div style={{ marginTop: '0.5rem', textAlign: 'center', fontSize: '0.9rem', color: '#666' }}>
            Уже есть аккаунт?{' '}
            <a href="/resident/login" style={{ color: '#0070f3', textDecoration: 'none' }}>
              Войти
            </a>
          </div>
        </form>
      </div>
    </main>
  )
}
