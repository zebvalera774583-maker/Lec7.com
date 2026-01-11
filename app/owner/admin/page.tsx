'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function OwnerAdminPage() {
  const [businesses, setBusinesses] = useState<any[]>([])
  const [showWizard, setShowWizard] = useState(false)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadBusinesses()
  }, [])

  const loadBusinesses = async () => {
    try {
      const response = await fetch('/api/businesses')
      if (response.ok) {
        const data = await response.json()
        setBusinesses(data)
        setShowWizard(data.length === 0)
      } else {
        setShowWizard(true)
      }
    } catch {
      setShowWizard(true)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, city, category }),
      })

      if (!response.ok) {
        throw new Error('Ошибка создания бизнеса')
      }

      const business = await response.json()
      setBusinesses([business])
      setShowWizard(false)
      setName('')
      setCity('')
      setCategory('')
      // Перезагружаем список бизнесов
      await loadBusinesses()
    } catch (error) {
      alert('Ошибка создания бизнеса')
    } finally {
      setLoading(false)
    }
  }

  if (showWizard) {
    return (
      <main style={{ 
        minHeight: '100vh',
        background: '#ffffff',
        padding: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ maxWidth: '500px', width: '100%' }}>
          <header style={{ marginBottom: '2rem' }}>
            <Link 
              href="/owner/welcome"
              style={{
                display: 'inline-block',
                marginBottom: '1rem',
                color: '#0070f3',
                textDecoration: 'none',
                fontSize: '1rem'
              }}
            >
              ← Назад
            </Link>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: '#1a1a1a',
              margin: 0
            }}>
              Создать бизнес
            </h1>
          </header>

          <form onSubmit={handleSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '500',
                color: '#1a1a1a'
              }}>
                Название бизнеса
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '500',
                color: '#1a1a1a'
              }}>
                Город
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '500',
                color: '#1a1a1a'
              }}>
                Категория
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading ? '#999' : '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  // Админка после создания бизнеса
  const business = businesses[0]

  return (
    <main style={{ 
      minHeight: '100vh',
      background: '#ffffff',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <header style={{ marginBottom: '3rem' }}>
          <Link 
            href="/owner/welcome"
            style={{
              display: 'inline-block',
              marginBottom: '1rem',
              color: '#0070f3',
              textDecoration: 'none',
              fontSize: '1rem'
            }}
          >
            ← Назад
          </Link>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: '#1a1a1a',
            margin: 0
          }}>
            Админка бизнеса
          </h1>
        </header>

        <div style={{
          padding: '2rem',
          background: '#f5f5f5',
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            margin: '0 0 1rem 0',
            color: '#1a1a1a'
          }}>
            {business?.name}
          </h2>
          <p style={{
            color: '#666',
            margin: '0.5rem 0'
          }}>
            {business?.city} • {business?.category}
          </p>
        </div>

        <Link
          href={`/biz/${business?.slug}`}
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            background: '#0070f3',
            color: 'white',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '1rem',
            fontWeight: '500'
          }}
        >
          Открыть публичную страницу →
        </Link>
      </div>
    </main>
  )
}
