'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isLatinOnly } from '@/lib/slug'

interface BusinessProfileEditorProps {
  businessId: string
  businessSlug: string
  portfolioCount: number
}

interface BusinessProfile {
  id: string
  businessId: string
  displayName: string | null
  avatarUrl: string | null
  statsCases: number
  statsProjects: number
  statsCities: number
  cities: string[]
  services: string[]
}

export default function BusinessProfileEditor({
  businessId,
  businessSlug: initialSlug,
  portfolioCount,
}: BusinessProfileEditorProps) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [cities, setCities] = useState<string[]>([])
  const [services, setServices] = useState<string[]>([])
  const [metrics, setMetrics] = useState({
    cases: 40,
    projects: 2578,
    cities: 4,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [displayNameError, setDisplayNameError] = useState('')

  // Загрузка профиля при монтировании
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/office/businesses/${businessId}/profile`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Не удалось загрузить профиль')
        }

        const profile: BusinessProfile = await response.json()
        setDisplayName(profile.displayName || '')
        setAvatarUrl(profile.avatarUrl || '')
        setCities(profile.cities || [])
        setServices(profile.services || [])
        setMetrics({
          cases: profile.statsCases,
          projects: profile.statsProjects,
          cities: profile.statsCities,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки профиля')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [businessId])

  // Индикатор веса страницы (MVP)
  const pageWeight =
    (avatarUrl ? 0.3 : 0) + portfolioCount * 0.5 + (displayName ? 0.2 : 0)

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value)
    if (value && !isLatinOnly(value)) {
      setDisplayNameError('Отображаемое имя должно содержать только латинские буквы, цифры, пробелы и дефисы')
    } else {
      setDisplayNameError('')
    }
  }

  const handleSave = async () => {
    // Валидация перед сохранением
    if (displayName && !isLatinOnly(displayName)) {
      setError('Отображаемое имя должно содержать только латинские буквы, цифры, пробелы и дефисы')
      return
    }

    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch(`/api/office/businesses/${businessId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          displayName: displayName || null,
          avatarUrl: avatarUrl || null,
          statsCases: metrics.cases,
          statsProjects: metrics.projects,
          statsCities: metrics.cities,
          cities,
          services,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка сохранения профиля')
      }

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        router.refresh()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения профиля')
    } finally {
      setSaving(false)
    }
  }

  const handleAddCity = () => {
    const city = prompt('Введите название города:')
    if (city && !cities.includes(city)) {
      setCities([...cities, city])
    }
  }

  const handleRemoveCity = (city: string) => {
    setCities(cities.filter((c) => c !== city))
  }

  const handleToggleService = (service: string) => {
    if (services.includes(service)) {
      setServices(services.filter((s) => s !== service))
    } else {
      setServices([...services, service])
    }
  }

  const availableServices = [
    'Проектная реализация',
    'Дизайн интерьера',
    'Мебель на заказ',
    'Комплектация',
  ]

  if (loading) {
    return (
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Загрузка профиля...</p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      {/* Шапка */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: avatarUrl ? `url(${avatarUrl})` : '#e5e7eb',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '2px solid #e5e7eb',
            }}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{displayName || 'Бизнес'}</h1>
            <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>/{initialSlug}</p>
          </div>
        </div>
        <Link
          href={`/~${initialSlug}`}
          target="_blank"
          style={{
            padding: '0.5rem 1rem',
            background: '#0070f3',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            fontSize: '0.875rem',
          }}
        >
          Открыть витрину →
        </Link>
      </div>

      {/* Сообщения об ошибках/успехе */}
      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: '4px',
            color: '#be123c',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            background: '#d1fae5',
            border: '1px solid #86efac',
            borderRadius: '4px',
            color: '#065f46',
            fontSize: '0.875rem',
          }}
        >
          Профиль успешно сохранён
        </div>
      )}

      {/* Индикатор веса */}
      <div
        style={{
          padding: '1rem',
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          marginBottom: '2rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: '#0369a1' }}>Вес страницы:</span>
          <span style={{ fontSize: '1rem', fontWeight: 600, color: '#0369a1' }}>
            {pageWeight.toFixed(1)} / 10
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* Основной контент */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Аватар */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Аватар бизнеса</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  background: avatarUrl ? `url(${avatarUrl})` : '#e5e7eb',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: '2px solid #e5e7eb',
                }}
              />
              <div>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="URL аватара"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    marginBottom: '0.5rem',
                  }}
                />
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#666' }}>
                  URL аватара (загрузка фото — позже)
                </p>
              </div>
            </div>
          </section>

          {/* Логотип / имя */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Логотип / имя</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Отображаемое имя бизнеса
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                placeholder="Valeriy Zebelyan"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: displayNameError ? '1px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
              {displayNameError && (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                  {displayNameError}
                </p>
              )}
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#666' }}>
                Только латинские буквы, цифры, пробелы и дефисы
              </p>
            </div>
          </section>

          {/* Загрузка фото */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Фото портфолио</h2>
            <button
              disabled
              style={{
                padding: '0.75rem 1.5rem',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'not-allowed',
                fontSize: '0.875rem',
                marginBottom: '1rem',
                opacity: 0.6,
              }}
            >
              + Загрузить фото (скоро)
            </button>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
              Фото портфолио: {portfolioCount} шт. (загрузка — позже)
            </p>
          </section>

          {/* Метрики */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Метрики</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  Уникальных кейсов
                </label>
                <input
                  type="number"
                  value={metrics.cases}
                  onChange={(e) => setMetrics({ ...metrics, cases: parseInt(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  Проектов
                </label>
                <input
                  type="number"
                  value={metrics.projects}
                  onChange={(e) => setMetrics({ ...metrics, projects: parseInt(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  Городов
                </label>
                <input
                  type="number"
                  value={metrics.cities}
                  onChange={(e) => setMetrics({ ...metrics, cities: parseInt(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                  }}
                />
              </div>
            </div>
          </section>

          {/* Города */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Города присутствия</h2>
              <button
                onClick={handleAddCity}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                + Добавить
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {cities.map((city) => (
                <div
                  key={city}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    background: '#f3f4f6',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                  }}
                >
                  <span>{city}</span>
                  <button
                    onClick={() => handleRemoveCity(city)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#666',
                      fontSize: '1.25rem',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Услуги */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Услуги</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {availableServices.map((service) => (
                <label
                  key={service}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={services.includes(service)}
                    onChange={() => handleToggleService(service)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span>{service}</span>
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Боковая панель */}
        <div>
          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              position: 'sticky',
              top: '2rem',
            }}
          >
            <button
              onClick={handleSave}
              disabled={saving || loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: saving || loading ? '#94a3b8' : '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving || loading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: 500,
                marginBottom: '1rem',
              }}
            >
              {saving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
            <Link
              href={`/office/businesses/${businessId}`}
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '0.75rem',
                color: '#666',
                textDecoration: 'underline',
                fontSize: '0.875rem',
              }}
            >
              ← Назад в кабинет
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
