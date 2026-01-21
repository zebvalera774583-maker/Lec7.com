'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import BusinessCardLink from '@/components/BusinessCardLink'

export default function VisitorClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [businesses, setBusinesses] = useState<any[]>([])
  const [allBusinesses, setAllBusinesses] = useState<any[]>([]) // Для формирования списков городов/категорий
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [city, setCity] = useState(searchParams.get('city') || '')
  const [category, setCategory] = useState(searchParams.get('category') || '')

  // Получаем уникальные города и категории из всех бизнесов (не отфильтрованных)
  const cities = useMemo(() => {
    const citySet = new Set<string>()
    allBusinesses.forEach(b => {
      if (b.city) citySet.add(b.city.trim())
    })
    return Array.from(citySet).sort()
  }, [allBusinesses])

  const categories = useMemo(() => {
    const categorySet = new Set<string>()
    allBusinesses.forEach(b => {
      if (b.category) categorySet.add(b.category.trim())
    })
    return Array.from(categorySet).sort()
  }, [allBusinesses])

  // Загружаем все бизнесы для формирования списков городов/категорий
  useEffect(() => {
    const loadAllBusinesses = async () => {
      try {
        const response = await fetch('/api/businesses')
        if (response.ok) {
          const data = await response.json()
          setAllBusinesses(data)
        }
      } catch (error) {
        console.error('Error loading all businesses:', error)
      }
    }
    loadAllBusinesses()
    loadBusinesses()
  }, [])

  // Обновляем URL и загружаем при изменении фильтров
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (city) params.set('city', city)
    if (category) params.set('category', category)
    
    const queryString = params.toString()
    router.push(queryString ? `/visitor?${queryString}` : '/visitor', { scroll: false })
    
    loadBusinesses()
  }, [search, city, category])

  const loadBusinesses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (city) params.set('city', city)
      if (category) params.set('category', category)

      const url = `/api/businesses?${params.toString()}`

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setBusinesses(data)
      }
    } catch (error) {
      console.error('Error loading businesses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
  }

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCity(e.target.value)
  }

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value)
  }

  const clearFilters = () => {
    setSearch('')
    setCity('')
    setCategory('')
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f7f2ee',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Верхняя полоса с логотипом */}
      <div
        style={{
          borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
          padding: '1.25rem 1.5rem',
        }}
      >
        <div
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
          }}
        >
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: '1.15rem',
                letterSpacing: '0.02em',
                color: '#0f172a',
              }}
            >
              Lec7
            </span>
          </Link>
        </div>
      </div>

      {/* Контент */}
      <div
        style={{
          flex: 1,
          padding: '2.5rem 1.5rem 3rem',
        }}
      >
        <div
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
          }}
        >
          {/* Поисковая строка */}
          <section
            style={{
              marginBottom: '2.25rem',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '999px',
                boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
                padding: '0.35rem 1.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <input
                type="text"
                placeholder="Мебель, дизайн, услуги… и город"
                value={search}
                onChange={handleSearchChange}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  padding: '0.9rem 0',
                  fontSize: '1rem',
                  color: '#111827',
                  background: 'transparent',
                }}
              />
              <button
                type="button"
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#111827',
                  cursor: 'default',
                }}
                aria-hidden="true"
              >
                <span style={{ fontSize: '1.4rem' }}>🔍</span>
              </button>
            </div>
          </section>

          {/* Фильтры / навигация */}
          <section
            style={{
              marginBottom: '1.75rem',
              borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1.5rem',
                paddingBottom: '0.85rem',
                fontSize: '0.9rem',
                color: '#6b7280',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Город</span>
                <select
                  value={city}
                  onChange={handleCityChange}
                  style={{
                    border: 'none',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.6)',
                    background: 'transparent',
                    padding: '0.1rem 0.25rem',
                    fontSize: '0.9rem',
                    color: '#374151',
                    outline: 'none',
                  }}
                >
                  <option value="">Любой</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Сфера</span>
                <select
                  value={category}
                  onChange={handleCategoryChange}
                  style={{
                    border: 'none',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.6)',
                    background: 'transparent',
                    padding: '0.1rem 0.25rem',
                    fontSize: '0.9rem',
                    color: '#374151',
                    outline: 'none',
                  }}
                >
                  <option value="">Любая</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                Формат: Магазин / Агентство / Сервис
              </div>

              {(search || city || category) && (
                <button
                  onClick={clearFilters}
                  style={{
                    marginLeft: 'auto',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(148, 163, 184, 0.6)',
                    background: 'transparent',
                    fontSize: '0.8rem',
                    color: '#6b7280',
                    cursor: 'pointer',
                  }}
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          </section>

          {/* Подзаголовок перед сеткой */}
          <section style={{ marginBottom: '1.5rem' }}>
            <p
              style={{
                margin: 0,
                fontSize: '0.9rem',
                color: '#9ca3af',
              }}
            >
              Показаны релевантные предложения
            </p>
          </section>

          {/* Результаты */}
          {loading ? (
            <div
              style={{
                textAlign: 'center',
                padding: '4rem 2rem',
                color: '#6b7280',
              }}
            >
              <p>Загрузка...</p>
            </div>
          ) : businesses.length > 0 ? (
            <section>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '1.75rem',
                }}
              >
                {businesses.map((business) => (
                  <BusinessCardLink key={business.id} business={business} />
                ))}
              </div>
            </section>
          ) : (
            <section>
              <div
                style={{
                  textAlign: 'center',
                  padding: '4rem 2rem',
                  color: '#6b7280',
                }}
              >
                <p style={{ fontSize: '1.05rem' }}>
                  {businesses.length === 0 && category
                    ? 'В этой категории пока нет предложений. Вы можете стать первым бизнесом на Lec7 в этой категории.'
                    : search || city || category
                    ? 'Ничего не найдено по заданным фильтрам'
                    : 'Пока нет предложений. Вы можете стать первым бизнесом на Lec7.'}
                </p>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Нижняя подпись */}
      <footer
        style={{
          padding: '1.5rem 1.5rem 2rem',
        }}
      >
        <div
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            textAlign: 'center',
            fontSize: '0.9rem',
            color: '#6b7280',
          }}
        >
          <span
            style={{
              fontWeight: 600,
              color: '#111827',
            }}
          >
            Lec7
          </span>{' '}
          — рабочая AI-инфраструктура для реальных сделок.
        </div>
      </footer>
    </main>
  )
}
