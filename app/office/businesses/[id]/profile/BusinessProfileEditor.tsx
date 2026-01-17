'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Portfolio {
  id: string
  title: string
  imageUrl: string
  order: number
}

interface Business {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  coverUrl: string | null
  portfolios: Portfolio[]
  _count: {
    portfolios: number
  }
}

interface BusinessProfileEditorProps {
  business: Business
}

export default function BusinessProfileEditor({ business: initialBusiness }: BusinessProfileEditorProps) {
  const router = useRouter()
  const [business, setBusiness] = useState(initialBusiness)
  const [name, setName] = useState(initialBusiness.name)
  const [avatar, setAvatar] = useState(initialBusiness.logoUrl || '')
  const [photos, setPhotos] = useState<Portfolio[]>(initialBusiness.portfolios)
  const [cities, setCities] = useState<string[]>(['Москва', 'Санкт-Петербург'])
  const [services, setServices] = useState<string[]>(['Проектная реализация', 'Дизайн интерьера'])
  const [metrics, setMetrics] = useState({
    cases: 40,
    projects: 2578,
    cities: 4,
  })
  const [loading, setLoading] = useState(false)

  // Индикатор веса страницы (MVP)
  const pageWeight = photos.length * 0.5 + (avatar ? 0.3 : 0) + (name ? 0.2 : 0)

  const handleSave = async () => {
    setLoading(true)
    // TODO: API для сохранения
    setTimeout(() => {
      setLoading(false)
      router.refresh()
    }, 500)
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

  const handleDeletePhoto = (photoId: string) => {
    setPhotos(photos.filter((p) => p.id !== photoId))
  }

  const availableServices = [
    'Проектная реализация',
    'Дизайн интерьера',
    'Мебель на заказ',
    'Комплектация',
  ]

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
              background: avatar ? `url(${avatar})` : '#e5e7eb',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '2px solid #e5e7eb',
            }}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{business.name}</h1>
            <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>/{business.slug}</p>
          </div>
        </div>
        <Link
          href={`/~${business.slug}`}
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
                  background: avatar ? `url(${avatar})` : '#e5e7eb',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: '2px solid #e5e7eb',
                }}
              />
              <div>
                <button
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  Загрузить фото
                </button>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#666' }}>
                  Круглый аватар для витрины
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Валерий Зебелян"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
            </div>
          </section>

          {/* Загрузка фото */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Фото портфолио</h2>
            <button
              style={{
                padding: '0.75rem 1.5rem',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                marginBottom: '1rem',
              }}
            >
              + Загрузить фото
            </button>
            {photos.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '1rem',
                }}
              >
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src={photo.imageUrl}
                      alt={photo.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      style={{
                        position: 'absolute',
                        top: '0.5rem',
                        right: '0.5rem',
                        background: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.25rem 0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#666', fontSize: '0.875rem' }}>Нет загруженных фото</p>
            )}
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
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: loading ? '#94a3b8' : '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: 500,
                marginBottom: '1rem',
              }}
            >
              {loading ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
            <Link
              href={`/office/businesses/${business.id}`}
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
